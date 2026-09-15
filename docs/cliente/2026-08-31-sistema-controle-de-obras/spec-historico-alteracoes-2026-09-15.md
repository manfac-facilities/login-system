# Spec — Histórico de alterações da obra (J4, seção D)

**Data:** 2026-09-15. **Autor:** sessão de especificação (subagente), a pedido do João.
**Status da seção:** D do mockup `mockup-j4-v01.html`, **Aprovada** pelo cliente em
`feedback-14-mockup-j4-v01.md`. Nenhuma outra decisão do cliente falta para esta seção.

**Fontes lidas:** `j4-decisoes-2026-09-14.md` (decisões 6 e 7), `j4-conciliacao-2026-09-14.md`
(inventário de campos §1, papéis §4), `feedback-14-mockup-j4-v01.md`, a seção D de
`mockup-j4-v01.html` (HTML + JS de `RENDER.D`, `HIST`, `HIST_C`, `aplicarB`,
`dialogoConcluir`), `sdd-sql-obras-v0.sql` (RLS, convenções), `sdd-sql-obras-sync-execucao.sql`
(precedente de RPC `security invoker`), `AGENTS.md` (as duas armadilhas de PL/pgSQL),
`app/obras/obra/[id]/_actions.ts`, `_ficha.tsx`, `_triagem.tsx`, `_etapa.tsx`,
`app/obras/_lib/tipos.ts`, `app/obras/sincronizar/_sincronizacao.ts`.

Este documento é só especificação: nenhum arquivo de código ou SQL foi criado ou alterado
para produzi-lo. Os blocos de SQL/TypeScript abaixo são **esqueletos ilustrativos** que
fixam a interface e a forma da solução — o plano de implementação (arquivo irmão) é quem
transforma isso em tarefas TDD com código real, testado e comitado.

---

## 1. O que a seção D promete, literalmente

Do mockup (`mockup-j4-v01.html:250-256`):

> Uma linha por campo alterado: bloco, campo, valor antigo, valor novo, quem e quando.
> Motivo só aparece na remarcação, que é onde ele é obrigatório.

E, no rodapé da seção B (`:234`):

> As alterações salvas aparecem no rodapé do bloco, em Remarcações e no Histórico
> (seção D).

E na esteira, seção C (`:844`):

> Qualquer pessoa com acesso pode mudar, e quem mudou e quando aparece no **Histórico**.

E, crítico para o desenho técnico, o texto do próprio mockup no estado de erro da seção D
(`linha 361-363` do arquivo lido, dentro de `RENDER.D`):

> Regra assumida neste mockup: salvar um bloco e gravar a linha do histórico acontecem
> juntos. Se o histórico não gravar, o bloco também não grava, e quem salvou vê o erro do
> bloco.

Isso não é decoração — é um requisito de atomicidade que molda a decisão da seção 5 deste
documento.

A decisão 6 do João (`j4-decisoes-2026-09-14.md:26`): **"Histórico por alteração: campo,
valor antigo, valor novo, quem, quando. Precisa de tabela nova (migration). Motivo não
obrigatório."** A decisão 7 acrescenta a exceção: mudar o **início** depois de liberada é
remarcação, com **motivo obrigatório**, e esse motivo aparece no histórico.

A conciliação (`j4-conciliacao-2026-09-14.md`, pergunta 6, recomendação C) argumenta por
que histórico por alteração (não por obra, não por bloco): é a única opção que responde
"quem mudou o valor desta obra" sem que a edição seguinte apague o rastro anterior.

---

## 2. Desenho de dados — tabela `obras_historico`

Nova tabela, migration `sdd-sql-obras-historico.sql`, seguindo a convenção de
`sdd-sql-obras-v0.sql` (idempotente, `begin`/`commit`, cabeçalho com estado e as duas
armadilhas de PL/pgSQL).

```sql
create table if not exists public.obras_historico (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,

  -- Chave estável, não o rótulo de tela. O rótulo se traduz na leitura (ver §7),
  -- do mesmo jeito que `nomeEtapa()` traduz `etapa` hoje. Se o texto do rótulo
  -- mudar amanhã (ex.: decisão 8, ainda pendente do cliente), as linhas antigas
  -- não precisam de backfill.
  bloco text not null check (bloco in (
    'Triagem','Autorização','Identificação','Cronograma','Esteira'
  )),
  campo text not null check (campo in (
    'pcm','equipe','prioridade','inicio_plan','duracao',
    'liberado_por','liberado_em','os_aprovada_em',
    'tipo','valor','origem','analista_cliente','mau_uso',
    'etapa','marco_exec_fim','marco_relatorio','marco_fechou_os',
    'marco_liberou_fat','marco_faturou'
  )),

  -- Já formatados para exibição (DD/MM/AAAA, R$, Sim/Não, nome da etapa) no
  -- momento da gravação — ver §7. `null` = campo estava/ficou vazio, exibido
  -- como "—". Nunca `''`, mesma convenção do resto do módulo.
  de text,
  para text,

  -- Só a remarcação do início preenche isto (decisão 7). Nulo em todo o resto.
  motivo text,

  -- Nunca vem do cliente: a função de gravar e a RLS o travam no e-mail
  -- autenticado (ver §5 e §6). NOT NULL: toda linha tem autor humano — a
  -- sincronização do Field nunca escreve aqui (§6).
  quem text not null,

  created_at timestamptz not null default now()
);

create index if not exists obras_historico_obra_idx
  on public.obras_historico (obra_id, created_at desc);

alter table public.obras_historico enable row level security;
```

**Por que `campo` e `bloco` são `check` fechado, não texto livre.** Mesma razão da
`obras_obra_fonte_check` em `sdd-sql-obras-fonte.sql`: quando um campo novo passar a ser
rastreado, isso é uma decisão de produto (o que é editável, o que é rastreado) e deve
virar `alter table ... add constraint` explícito e auditável, não um texto solto que a
tela decide sozinha. A lista de `campo` acima é a leitura do inventário §1.A/1.B da
conciliação, restrita aos campos que este documento decide rastrear — ver §7 para a
tabela completa com bloco, rótulo de tela e formatação.

**`os_aprovada_em` não é uma coluna de `obras_obra`.** É a chave sintética para o
controle único da decisão 4 (`j4-decisoes-2026-09-14.md:33`): "Um controle só: 'OS
aprovada em [data]'. Com data preenchida grava `os_aprovada = true` e a mesma data em
`aprovacao` e `marco_os_aprov`." As três colunas mudam **juntas**, sempre, pelo mesmo
clique — sem esta chave sintética, uma alteração geraria três linhas quase-idênticas no
histórico (a contradição 6 da conciliação, "três representações da mesma aprovação",
voltaria a aparecer agora dentro do próprio histórico). `marco_os_aprov` e `os_aprovada`
**nunca** geram linha própria; só `aprovacao`, sob o rótulo "OS aprovada em" — ver §8.

---

## 3. RLS — leitura para quem tem acesso, escrita que não falsifica nem apaga

```sql
create policy "obras historico leitura" on public.obras_historico
  for select to authenticated
  using (public.obras_has_access());

create policy "obras historico escrita" on public.obras_historico
  for insert to authenticated
  with check (
    public.obras_has_access()
    and quem = lower(trim(auth.jwt() ->> 'email'))
  );

-- Nenhuma policy de update nem de delete. RLS nega por padrão o que não tem
-- policy: a tabela é INSERT-only por construção, para qualquer papel,
-- inclusive obras_is_admin(). É o mecanismo que cumpre "não permita editar ou
-- apagar histórico" — não é regra de tela, é o banco recusando.
```

Isso segue exatamente o padrão de `obras_has_access()` das outras 5 tabelas do módulo
(`sdd-sql-obras-v0.sql:346-369`) para leitura, e usa `exists(...)` por baixo
(`obras_is_admin`/`obras_has_access` já devolvem sempre `true`/`false`, nunca `NULL` —
armadilha 1 do `AGENTS.md` já evitada por construção, porque a função é reaproveitada, não
reescrita).

**Por que nenhuma policy de update/delete, nem para admin.** A decisão 6 fala em "fica
registrado quem mudou" como mecanismo de confiança — um histórico que o próprio autor (ou
um admin) pudesse apagar não cumpre essa promessa. Não há hoje pedido do cliente para
corrigir uma linha de histórico; se aparecer, é migration nova com policy nova, decisão
explícita, não uma porta deixada aberta por acaso.

**Por que a escrita trava `quem = lower(trim(auth.jwt() ->> 'email'))` na própria RLS**,
e não só na função que grava (§5): defesa em profundidade. Se algum caminho futuro
inserir direto via PostgREST (`/rest/v1/obras_historico`) sem passar pela função de
gravar, ainda assim não dá para forjar autor — a policy recusa. `lower(trim(...))` casa
com a convenção de e-mail em minúsculas já usada em `obras_pessoa.email`
(`sdd-sql-obras-v0.sql:204-207`) e nas duas funções de autorização.

---

## 4. Sincronização do Field: **não grava histórico**

A pergunta do João pede uma decisão explícita — aqui está, com a justificativa.

**Decisão: a sincronização (`app/obras/sincronizar/_sincronizacao.ts` e `_execucao.ts`)
nunca chama a função de gravar histórico. Zero linhas de `obras_historico` nascem da
sincronização.**

Por quê:

1. **A sincronização não tem usuário para nomear.** Ela roda por `pg_cron` com o
   `service_role` (via `app/api/obras/sincronizar/route.ts`, protegido por
   `OBRAS_CRON_SECRET`) ou pelo botão do admin em `/obras/sincronizar`, mas mesmo aí quem
   grava no banco é o servidor, não a sessão do admin logado — `_sincronizacao.ts` já não
   lê `auth.getUser()`. `quem text not null` na tabela não teria um valor verdadeiro para
   colocar. Inventar um sentinela ("Sistema", "Sincronização Field") quebraria a garantia
   de que `quem` é sempre um e-mail autenticado real — a mesma garantia que a RLS do §3
   trava.
2. **O escopo do histórico, no mockup, é a edição feita por gente.** As seções B (blocos
   editáveis) e C (esteira) são os dois geradores de `HIST`/`HIST_C` no mockup — ambos
   População por ação de um usuário autenticado (`quem:'Você'`, `quem:'YURI'`,
   `quem:'LUANA'`, `quem:'AMANDA'`). Nenhuma linha de exemplo tem "Field" como autor. A
   linha "Entrada" que aparece no rodapé da lista (`RENDER.D`, linha final: "Obra criada
   pela sincronização, com Nº OS, loja e chamado") **não vem de `ob.hist`** — é montada à
   parte, fora do array, só quando o filtro é "Todos". Ela é sintética.
3. **A sincronização já tem o próprio rastro de auditoria**, agregado por execução:
   `obras_sync_execucao` (novas, atualizadas, inalteradas, avisos, etc.). Duplicar isso
   linha a linha em `obras_historico` — potencialmente 3 colunas (`loja`, `descricao`,
   `field_id`) × até 187 obras por carga completa — não paga o custo: ninguém pediu "quem
   mudou a loja quando o Field sincronizou", e a resposta sempre seria "o Field, na
   sincronização", que já está em `obras_sync_execucao.finalizada_em`.
4. **Os únicos campos que a sincronização escreve** (`os`, `loja`, `descricao`, `fonte`,
   `field_id`, e a etapa inicial na criação) **não estão na lista de campos rastreados do
   §2/§7** — são justamente os três campos "vêm do Field", que a decisão 9 da J4 deixa só
   leitura na tela (`j4-decisoes-2026-09-14.md:35`). Mesmo que a sincronização chamasse a
   função de gravar por engano, não haveria linha para produzir: a checagem de
   "campo rastreado" (§7) simplesmente não reconheceria essas colunas.

**Consequência prática para o componente de exibição (§9):** a linha "Entrada" (data de
`obra.created_at`, rotulada "Field" quando `obra.fonte = 'field'`) é **calculada e
desenhada pelo componente**, não lida de `obras_historico`. `_historico.tsx` recebe
`obra.created_at` e `obra.fonte` como props além das linhas reais, exatamente como o
mockup monta `ob.entrada` separado de `ob.hist`.

**O que isto NÃO decide:** se um dia o cliente pedir "quero saber quando o Field trocou o
número da OS" (o `numerosDeOsAlterados` que `_sincronizacao.ts` já registra em memória,
mas não persiste), essa é uma tabela ou coluna de auditoria da sincronização, não uma
extensão deste histórico — ele é, por desenho, sobre edição humana.

---

## 5. Onde a gravação acontece: TypeScript, orquestrado da Server Action, com uma RPC só para a atomicidade

**Decisão: a gravação NÃO é uma trigger. É TypeScript — uma função pura que calcula o
diff e uma função que grava — chamada de dentro de cada Server Action. A única peça em
SQL além da tabela é uma função (RPC) puramente mecânica, sem lógica de negócio, cujo
único papel é fazer o `update` da obra e o `insert` do histórico na mesma transação.**

### Por que não trigger

Uma trigger `after update` em `obras_obra` que calculasse o diff sozinha resolveria a
atomicidade de graça (mesma transação do `update`, by definition) e até resolveria "quem"
sozinha por um efeito colateral: pelo que o `AGENTS.md` documenta, `auth.jwt()` é `NULL`
quando quem escreve é o SQL Editor, o MCP ou o `service_role` — logo, uma trigger que só
gravasse quando `auth.jwt() ->> 'email'` não é nulo automaticamente pularia a
sincronização, sem precisar de nenhuma outra regra. Foi cogitado.

Rejeitado por três razões:

1. **O pedido do João já desenha a arquitetura em TypeScript.** Ele pede explicitamente
   "uma função pura... que recebe o antes e o depois e devolve as linhas de alteração
   (com testes)" e "a função de gravar" como peças de `app/obras/_lib/historico.ts`. Isso
   só faz sentido se o diff acontece em TS — uma trigger faria o mesmo cálculo em
   PL/pgSQL, e aí a função pura em TS ficaria sem papel (ou duplicaria a lógica em duas
   linguagens, que é pior que as duas alternativas isoladas).
2. **O "quem" e o "motivo" já estão à mão na Server Action, sem truque.** `auth.getUser()`
   já roda no topo de toda action (receita fixa, `_actions.ts:6-13`). Uma trigger
   precisaria de `set local` de uma variável de sessão para receber o motivo da
   remarcação (que não é coluna de `obras_obra`) — mecanismo válido em Postgres, mas é
   complexidade nova neste módulo, que hoje não usa `current_setting` em lugar nenhum, e
   frágil se o driver do Supabase não preservar a sessão entre `set local` e `update` (o
   `supabase-js` normalmente faz um request HTTP por chamada; garantir que os dois caiam
   na mesma transação exigiria a mesma RPC que a decisão abaixo já usa — nesse caso, a
   trigger não economiza a RPC, só move a lógica para dentro dela).
3. **Esta base de código não usa trigger para regra de negócio.** A única trigger do
   módulo, `obras_touch_updated_at`, é puramente mecânica (`new.updated_at := now()`) e
   presa a uma tabela só — é literalmente o exemplo que o cabeçalho de
   `sdd-sql-obras-v0.sql` cita como o jeito de **evitar** a armadilha 2 (trigger
   compartilhada por tabelas de colunas diferentes). Toda regra derivada do módulo vive em
   `_lib/tipos.ts` ("NADA DE CAMPO DERIVADO AQUI" — comentário do próprio arquivo,
   `sdd-sql-obras-v0.sql:55-58`). Colocar a primeira regra de negócio real numa trigger
   quebraria essa convenção sem necessidade.

### Como a atomicidade é resolvida sem trigger

O requisito do mockup ("salvar o bloco e gravar o histórico acontecem juntos") não sai de
graça em TypeScript: duas chamadas separadas do `supabase-js` (`update` em `obras_obra`,
depois `insert` em `obras_historico`) são dois requests HTTP, duas transações do
PostgREST — se a segunda falhar, o campo já mudou e o histórico ficou incompleto,
exatamente o que o mockup promete que não acontece.

A saída, com precedente já neste módulo: **uma função RPC `security invoker`**, do mesmo
jeito que `obras_iniciar_sync_execucao` (`sdd-sql-obras-sync-execucao.sql:58-106`) já
resolve "uma ação, uma transação, uma chamada de `supabase.rpc(...)`". A função:

```sql
create or replace function public.obras_aplicar_alteracao(
  p_obra_id uuid,
  p_campos jsonb,   -- só as colunas que mudaram, ex.: {"pcm":"YURI","equipe":"MANFAC-7"}
  p_linhas jsonb    -- array já calculado pela função pura do TS: [{bloco,campo,de,para,motivo}, ...]
)
returns public.obras_obra
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_quem   text := lower(trim(auth.jwt() ->> 'email'));
  v_quando timestamptz := clock_timestamp();
  v_obra   public.obras_obra;
begin
  if not public.obras_has_access() then
    raise exception 'Sem acesso ao Controle de Obras' using errcode = '42501';
  end if;
  if v_quem is null or v_quem = '' then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  -- Atualização parcial e SEM SQL dinâmico: jsonb_populate_record(o, p_campos)
  -- preenche só as chaves presentes em p_campos por cima da linha atual — a
  -- lista de colunas abaixo é ESTÁTICA (todas as colunas elegíveis a este
  -- caminho de escrita); quem não vier em p_campos simplesmente não muda.
  update public.obras_obra o set (
    pcm, equipe, prioridade, inicio_plan, duracao,
    liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
    tipo, valor, origem, analista_cliente, mau_uso,
    etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
    marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou
  ) = (
    select
      pcm, equipe, prioridade, inicio_plan, duracao,
      liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
      tipo, valor, origem, analista_cliente, mau_uso,
      etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
      marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou
    from jsonb_populate_record(o, p_campos)
  )
  where o.id = p_obra_id
  returning * into v_obra;

  if not found then
    raise exception 'Obra não encontrada ou sem permissão' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_linhas, '[]'::jsonb)) > 0 then
    insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
    select p_obra_id, x.bloco, x.campo, x.de, x.para, x.motivo, v_quem, v_quando
    from jsonb_to_recordset(p_linhas) as x(bloco text, campo text, de text, para text, motivo text);
  end if;

  return v_obra;
end;
$$;

revoke execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) to authenticated;
```

**Por que isto não reabre nenhuma das duas armadilhas do `AGENTS.md`:**

- Armadilha 1 (guarda de autorização que falha aberto com `NULL`): aqui não há
  `if not f() then raise` sobre uma função que possa devolver `NULL` — `obras_has_access()`
  já devolve sempre booleano (herda a garantia existente), e o `if v_quem is null`
  trata explicitamente o caso do `service_role`/SQL Editor, não silenciosamente.
- Armadilha 2 (trigger compartilhada entre tabelas de colunas diferentes via
  `TG_TABLE_NAME` numa mesma expressão): esta função não é trigger, roda numa tabela só, e
  não tem ramificação por tabela nenhuma — a armadilha não se aplica.
- **security invoker, não definer**: a função roda com o papel de quem chama
  (`authenticated`), então tanto o `update` em `obras_obra` quanto o `insert` em
  `obras_historico` continuam sob a RLS normal dessas tabelas — sem elevar privilégio. Isso
  segue o mesmo padrão de `obras_iniciar_sync_execucao`.
- `v_quem` nunca vem de `p_linhas` nem de `p_campos` — é lido direto do JWT dentro da
  função, então mesmo que o TypeScript que monta `p_linhas` tivesse um bug e mandasse
  `quem` errado, a coluna `quem` da tabela não usaria esse valor (defesa em profundidade,
  reforçando a RLS do §3).
- `set (col1, col2, ...) = (select col1, col2, ... from jsonb_populate_record(o, p_campos))`
  é o idioma padrão do Postgres para "atualização parcial via JSON sem SQL dinâmico": a
  lista de colunas é fixa no texto da função (auditável, sem `format()`/`execute`), e
  qualquer chave de `p_campos` fora dessa lista é simplesmente ignorada pelo Postgres —
  não é um vetor de escrita arbitrária em coluna não prevista.

### Divisão de responsabilidade entre as três peças de TS

```
Server Action (Parte 2, bloqueada pela J4)
  │
  │  1. busca "antes" (a Action já teria a linha, ou faz um select)
  │  2. monta "depois" (os valores que o formulário mandou)
  │
  ├─► linhasDeAlteracao(antes, depois, bloco, opts?)      ┐
  │     _lib/historico.ts — PURA, testada com Jest,       │  Parte 1
  │     sem I/O, sem Supabase                              │  (este plano)
  │                                                          │
  └─► gravarComHistorico(supabase, { obraId, campos, linhas })
        _lib/historico.ts — chama supabase.rpc('obras_aplicar_alteracao', ...)
        Devolve { data: ObraRow } | { error: string }, nunca lança
        (mesma convenção de EstadoAcao das outras actions)
```

`gravarComHistorico` **substitui** o `.update(...)` direto que `_actions.ts` faz hoje —
não se soma a ele. Isso é o que garante a atomicidade: existe só UMA chamada de rede por
salvamento (a RPC), não duas.

---

## 6. Campos rastreados — tabela completa (bloco, campo, rótulo, formatação)

O rastreamento é **por campo do domínio**, não por coluna crua sempre que os dois
divergem (caso do controle "OS aprovada em", §8). `bloco` é decidido pela **tela/ação que
fez a mudança**, não deduzido da coluna — é assim que o mockup distingue uma obra sendo
definida pela primeira vez (Triagem) de uma já liberada sendo editada depois (Cronograma),
mesmo quando é a mesma coluna (`pcm`, `equipe`, `prioridade`, `inicio_plan`, `duracao`) que
muda nos dois casos.

| `campo` (chave estável) | Coluna(s) em `obras_obra` | `bloco` possível | Rótulo de tela | Formatação de `de`/`para` |
|---|---|---|---|---|
| `pcm` | `pcm` | Triagem · Cronograma | Responsável da obra | texto |
| `equipe` | `equipe` | Triagem · Cronograma | Equipe / prestador | texto |
| `prioridade` | `prioridade` | Triagem · Cronograma | Prioridade | texto |
| `inicio_plan` | `inicio_plan` | Triagem · Cronograma | Início planejado | `br()` (DD/MM/AAAA) |
| `duracao` | `duracao` | Triagem · Cronograma | Duração em dias | `"N dias"` |
| `liberado_por` | `liberado_por` | Triagem · Autorização | Liberado por | texto |
| `liberado_em` | `liberado_em` | Triagem · Autorização | Data da liberação | `br()` |
| `os_aprovada_em` | `aprovacao` + `os_aprovada` + `marco_os_aprov` (sintético, §8) | Triagem · Autorização · Esteira | OS aprovada em | `br()`, ou "—" quando `os_aprovada=false` |
| `tipo` | `tipo` | Triagem · Identificação | Tipo | texto |
| `valor` | `valor` | Triagem · Identificação | Valor | `moeda()` |
| `origem` | `origem` | Triagem · Identificação | Origem | texto |
| `analista_cliente` | `analista_cliente` | Triagem · Identificação | Analista do cliente | texto |
| `mau_uso` | `mau_uso` | Identificação | Classificação | `"Mau uso"` / `"normal"` |
| `etapa` | `etapa` | Esteira | Etapa | `nomeEtapa()` |
| `marco_exec_fim` | `marco_exec_fim` | Esteira | Data de fim da execução em campo | `br()` |
| `marco_relatorio` | `marco_relatorio` | Esteira | Data do relatório de entrega | `br()` |
| `marco_fechou_os` | `marco_fechou_os` | Esteira | Data de fechamento da OS | `br()` |
| `marco_liberou_fat` | `marco_liberou_fat` | Esteira | Data do faturamento liberado ¹ | `br()` |
| `marco_faturou` | `marco_faturou` | Esteira | Data de faturamento | `br()` |

¹ Nome pendente da decisão 8 (feedback 09, ainda não enviado ao cliente — ver §10). Usa o
nome atual do código, como o resto do mockup (`j4-decisoes-2026-09-14.md`, seção "Pendente
do cliente"). Trocar o nome depois é UPDATE de um dicionário de rótulos em TS — as linhas
já gravadas continuam íntegras, porque `campo` guarda a chave (`marco_liberou_fat`), não o
texto.

**Deliberadamente fora da lista — e por quê:**

| Coluna | Por que fica de fora |
|---|---|
| `os`, `loja`, `descricao` | Vêm do Field, só leitura na tela (decisão 9). A sincronização os escreve sem usuário (§4); a UI nunca oferece campo de edição para eles |
| `marco_os_aprov`, `os_aprovada` (isoladas) | Absorvidas em `os_aprovada_em` — nunca geram linha própria (§2, §8) |
| `desde_etapa`, `atualizacao`, `pendencia`, `pend_resp`, `pend_prazo`, `prox_acao`, `nao_andou_seguidos`, `bloqueada_dias`, `bloqueio` | Bookkeeping interno/derivado-adjacente que toda ação já escreve de carona (ex.: `liberarObraAction` grava `pendencia` fixa junto com os 5 campos). Não é isso que "campo alterado" significa nas amostras do mockup — nenhuma linha de `HIST`/`HIST_C` mostra "Pendência: ... → ..." |
| `inicio_real`, `fim_real` | Nunca escritos por tela nenhuma hoje (contradição 8 da conciliação); ficam de fora até ganharem uma tela |
| `updated_at`, `created_at`, `criado_por`, `id` | Metadado de linha, não "campo da obra" |

Se um campo novo precisar entrar depois, é: (1) `alter table ... drop constraint
obras_historico_campo_check, add constraint ... check (campo in (..., 'novo_campo'))`; (2)
uma entrada nova no dicionário de rótulos em `_lib/historico.ts`. Nenhuma linha existente
muda de forma.

---

## 7. Caso especial — "OS aprovada em" (decisão 4 + este histórico)

Quando a Server Action grava o controle único da decisão 4 (Autorização: um campo de
data, "OS aprovada no sistema do cliente em [data]"), ela decide **um único** `campo:
'os_aprovada_em'` mesmo que três colunas mudem:

- Preencher a data pela primeira vez: `de: '—'`, `para: br(data)`.
- Apagar a data (voltar a "não aprovada"): `de: br(dataAntiga)`, `para: '—'`.
- Trocar a data (aprovação corrigida): `de: br(antiga)`, `para: br(nova)`.

Isso vale tanto quando o controle é editado no bloco Autorização da Ficha quanto quando é
preenchido pelo diálogo "Concluir esta etapa" no passo `aprovarOS` da esteira (decisão 11:
preencher "OS aprovada em" com a obra em Pendente fechamento avança a etapa com aviso) —
nesse segundo caso, a Server Action grava **duas** linhas na mesma chamada:
`bloco: 'Esteira'`, `campo: 'etapa'` (`de: 'Pendente fechamento'`, `para: 'Fechar OS'`) e
`bloco: 'Esteira'`, `campo: 'os_aprovada_em'` — exatamente como `HIST_C` do mockup mostra
duas linhas com o mesmo `q` (mesmo `created_at`, porque `v_quando` é fixado uma vez por
chamada da RPC, §5) para uma conclusão de etapa que também grava a data do marco.

**A função pura `linhasDeAlteracao` não decide sozinha quando isso acontece** — ela recebe
`antes`/`depois` já no formato de "campos do domínio" (o chamador já resolveu que
`os_aprovada_em` mudou, olhando `aprovacao`), não as colunas cruas de `obras_obra`. Isso
mantém a função simples (compara chave a chave de um objeto pequeno) e deixa a decisão "o
que é um campo do domínio" em um único lugar: a assinatura de `linhasDeAlteracao` (ver
§9).

---

## 8. Caso especial — remarcação (decisão 7, motivo obrigatório)

Mudar `inicio_plan` **depois que a obra tem `liberado_por` OU `os_aprovada`** (ou seja,
depois de "liberada" no sentido do mockup) é remarcação: grava uma linha em
`obras_remarcacao` (`de`, `para`, `motivo`, já existente em `sdd-sql-obras-v0.sql:218-226`)
**e** uma linha em `obras_historico` com `campo: 'inicio_plan'`, `bloco: 'Cronograma'`, e
o `motivo` preenchido — o único caso em que a coluna `motivo` de `obras_historico` não é
nula.

**Quem decide "motivo obrigatório aqui" não é a função pura nem o banco — é a Server
Action, na validação de formulário**, igual a todas as outras validações do módulo
(`_actions.ts:132-136`, os 5 obrigatórios da Triagem revalidados no servidor). A função
`linhasDeAlteracao` aceita um `opts.motivoRemarcacao` opcional: se `inicio_plan` mudou e
esse parâmetro não veio, a função **lança** (não retorna array vazio nem linha sem
motivo) — é uma trava de programação (Parte 2 chamando errado), não de produto, mas fica
alto o suficiente para nunca passar despercebida num teste. A trava de produto de verdade
("mostre erro para o usuário, não deixe salvar sem motivo") continua na tela, como hoje.

Antes de "liberada", `inicio_plan` é só um dos 5 campos obrigatórios da Triagem — muda
livre, sem motivo, sem remarcação (a obra ainda não tem cronograma para remarcar).

---

## 9. Interface das três peças de TypeScript (Parte 1)

```ts
// app/obras/_lib/historico.ts

export type BlocoHistorico =
  | 'Triagem' | 'Autorização' | 'Identificação' | 'Cronograma' | 'Esteira'

export type CampoHistorico =
  | 'pcm' | 'equipe' | 'prioridade' | 'inicio_plan' | 'duracao'
  | 'liberado_por' | 'liberado_em' | 'os_aprovada_em'
  | 'tipo' | 'valor' | 'origem' | 'analista_cliente' | 'mau_uso'
  | 'etapa'
  | 'marco_exec_fim' | 'marco_relatorio' | 'marco_fechou_os'
  | 'marco_liberou_fat' | 'marco_faturou'

/** Uma linha ainda não gravada — o formato que a RPC espera em `p_linhas`. */
export type LinhaHistoricoNova = {
  bloco: BlocoHistorico
  campo: CampoHistorico
  de: string | null    // já formatado (br()/moeda()/nomeEtapa()/etc.)
  para: string | null
  motivo?: string | null
}

/** Uma linha já gravada — o formato de leitura, usado pelo componente (§10). */
export type LinhaHistorico = LinhaHistoricoNova & {
  id: string
  obra_id: string
  quem: string
  created_at: string
}

/**
 * Compara um subconjunto de "campos do domínio" (antes/depois) e devolve uma
 * linha por campo que realmente mudou. PURA: nenhum I/O, nenhuma chamada a
 * Supabase, nenhuma leitura de relógio — a hora e o autor são responsabilidade
 * da RPC (§5), não desta função.
 *
 * `antes`/`depois` usam as MESMAS chaves de CampoHistorico, já no valor
 * "de domínio" — quem chama já resolveu, por exemplo, que os_aprovada_em é
 * `obra.aprovacao` (ou null se `!obra.os_aprovada`), não as 3 colunas cruas.
 *
 * Lança Error se `inicio_plan` estiver em `depois` com valor diferente do de
 * `antes` e `opts.motivoRemarcacao` não vier preenchido (ver §8) — só quando
 * `exigirMotivoRemarcacao` for true (a Triagem, antes de liberada, chama com
 * false; a Ficha, depois de liberada, chama com true).
 */
export function linhasDeAlteracao(
  antes: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  depois: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  bloco: BlocoHistorico,
  opts?: { motivoRemarcacao?: string | null; exigirMotivoRemarcacao?: boolean }
): LinhaHistoricoNova[]

/**
 * Chama a RPC `obras_aplicar_alteracao`. Nunca lança — devolve
 * `{ error: string }` na falha, seguindo a convenção `EstadoAcao` de
 * `_actions.ts`. `campos` são as colunas CRUAS de `obras_obra` a atualizar
 * (não as chaves de CampoHistorico — a Parte 2 traduz na hora de montar a
 * chamada, porque uma mesma mudança de domínio pode tocar mais de uma coluna,
 * caso do os_aprovada_em).
 */
export async function gravarComHistorico(
  supabase: SupabaseClient,
  params: { obraId: string; campos: Record<string, unknown>; linhas: LinhaHistoricoNova[] }
): Promise<{ data?: ObraRow; error?: string }>
```

---

## 10. Componente de exibição — `obra/[id]/_historico.tsx`

Client Component (precisa dos chips de filtro interativos, como `_etapa.tsx` já é client
por precisar de interação). Recebe as linhas **já buscadas** por quem o montar — não faz
sua própria query a Supabase. Isso é deliberado: mantém o componente isolado dos três
arquivos restritos (§11) e testável com React Testing Library sem mocar rede.

```ts
export default function Historico({
  linhas,
  entrada,       // { data: string; fonte: 'field' | null } — para a linha sintética
}: {
  linhas: LinhaHistorico[]
  entrada: { data: string; fonte: string | null }
}): JSX.Element
```

Comportamento, direto da seção D do mockup:

- Chips de filtro: Todos · Triagem · Autorização · Identificação · Cronograma · Esteira
  (`FILTROS` do mockup, linha 335). Filtragem **em memória**, sem nova query — todas as
  linhas já vieram num só `select`.
- Cada linha: `quando` (data + hora) · `quem` · tag do bloco · `campo`: `de` → **`para`**
  · `motivo` em linha própria quando presente (só remarcação) · nenhum `obs` livre — o
  mockup tem `obs` (ex.: "concluída pelo botão", "data corrigida") como texto auxiliar por
  linha; este componente não inventa esse texto (a Parte 2 decide se ele é necessário e,
  se for, é um campo adicional opcional na tabela, fora do escopo aprovado da decisão 6,
  que não menciona "obs" — ver ambiguidade §12).
- Lista vazia (0 linhas, obra recém-chegada): estado vazio, texto equivalente ao do
  mockup ("Nenhuma alteração desde a entrada pelo Field").
- A linha "Entrada" (sintética, `entrada.data` formatada com `br()`, rotulada "Field" só
  quando `entrada.fonte === 'field'`, senão sem etiqueta) sempre aparece por último, e só
  quando o filtro é "Todos" — igual ao mockup.
- Erro ao carregar: este componente não busca dados, então não tem estado de erro de
  fetch próprio — quem lê (Parte 2, no `page.tsx`) trata o erro do `select` como já trata
  os outros `Promise.all` da página hoje (se vier `null`/erro, passa lista vazia; a rota
  não quebra a página inteira por causa do histórico).

---

## 11. Divisão Parte 1 / Parte 2

### Parte 1 — isolada, implementável agora (este plano cobre só isto)

| Arquivo | O que entra |
|---|---|
| `sdd-sql-obras-historico.sql` (raiz) | Tabela, índice, RLS (§3), a RPC `obras_aplicar_alteracao` (§5) |
| `app/obras/_lib/historico.ts` | `linhasDeAlteracao`, `gravarComHistorico`, os tipos do §9, o dicionário `campo → rótulo` |
| `app/obras/__tests__/historico.test.ts` | Testes de `linhasDeAlteracao` (puro, sem mock de Supabase — mesmo padrão de `tipos.test.ts`) |
| `app/obras/obra/[id]/_historico.tsx` | Componente de exibição do §10 |
| `app/obras/obra/[id]/__tests__/_historico.test.tsx` (ou em `app/obras/__tests__/`) | Testes de render com React Testing Library |

**Nenhum destes arquivos importa ou é importado por `_actions.ts`, `_ficha.tsx` ou
`_triagem.tsx`.** `_historico.tsx` fica "órfão" (não usado por nenhuma página) até a
Parte 2 — isso é esperado e seguro: TypeScript/lint não reclama de um componente
exportado e não usado ainda (é `export default`, não código morto detectável por
`no-unused-vars`), e os testes cobrem a peça isoladamente.

### Parte 2 — ligação, bloqueada pela J4

Fica descrita aqui para não se perder, **não** é tarefa deste plano:

1. Em cada Server Action nova que a J4 escrever em `_actions.ts` (salvar bloco da Ficha,
   salvar dados/liberar da Triagem, concluir etapa, corrigir data, remarcar): trocar a
   chamada direta `.from('obras_obra').update(...)` por `linhasDeAlteracao(...)` +
   `gravarComHistorico(...)`.
2. Em `page.tsx`: acrescentar `supabase.from('obras_historico').select('*').eq('obra_id',
   id).order('created_at', { ascending: false })` ao `Promise.all` existente
   (`page.tsx:81-88`), e renderizar `<Historico linhas={...} entrada={{ data:
   obra.created_at, fonte: obra.fonte }} />` — provavelmente como uma nova seção na
   Ficha, ou como bloco próprio fora de `<Ficha>` para não tocar `_ficha.tsx` se a J4
   ainda não tiver mesclado. **Decisão de layout exato fica com quem implementa a Parte
   2**, olhando o `_ficha.tsx` que a J4 realmente entregar.
3. `SeletorEtapa` (`_etapa.tsx`, hoje chama `mudarEtapaAction` direto) também precisa
   virar um chamador de `gravarComHistorico` se continuar existindo como está — mas a
   seção C do mockup (`aprovado? não — "Ajustar"`, feedback 14) sugere que o seletor livre
   pode mudar de forma na rodada de ajuste da J4. Cabe a quem entregar a Parte 2 confirmar
   contra a versão final de `_etapa.tsx`/`_actions.ts`.
4. Migrar `mudarEtapaAction` (hoje grava `etapa_por`/`etapa_em` direto, com fallback para
   coluna ausente — `_actions.ts:44-93`) para o novo caminho, **removendo** o fallback de
   "coluna inexistente" (`colunaInexistente()`, `_actions.ts:44-48`): essas colunas já
   estão em produção desde 10/09 (`AGENTS.md`), o fallback é resíduo pré-deploy.

---

## 12. Ambiguidades de produto (listadas, não resolvidas aqui)

1. **Granularidade de "campo alterado" fora do que o mockup mostrou.** A seção D só
   demonstrou blocos B (Autorização/Identificação/Cronograma) e C (Esteira). A Triagem
   (bloco A) nunca aparece gerando `HIST` no mockup interativo — a Parte 2 precisa decidir
   se "Salvar dados" (opcional, antes de liberar) e "Liberar" geram linhas separadas ou
   uma única leva no momento de liberar. Este documento assume que sim, ambas geram
   histórico (decisão 6 não faz exceção), mas o **momento exato** (a cada "Salvar dados"
   clicado, ou só na liberação final) é ambíguo e cabe à Parte 2 decidir olhando o
   fluxo real que a J4 construir.
2. **Campo `obs` do mockup** ("concluída pelo botão", "data corrigida", "passo pulado —
   ninguém concluiu pelo botão") não está na decisão 6 nem na tabela deste documento. É
   uma nota-múltipla explicativa por linha, não um "campo alterado" — se o cliente
   confirmar que quer isso na tela real, é uma coluna nova (`obs text`) e uma decisão
   pequena de produto, não deste plano.
3. **Paginação/limite do histórico.** Uma obra editada por meses pode acumular dezenas de
   linhas. O mockup não pagina (mostra tudo). Este documento não define limite —
   assumido "sem limite" para a Parte 1 (índice já ordena por `created_at desc`, o que
   paginação futura usaria sem migration nova).
4. **Nome de `marco_liberou_fat`** depende da decisão 8, ainda pendente do cliente
   (feedback 09, 4 perguntas não enviadas). Não bloqueia esta migration — só o rótulo em
   TS, trocável sem migration (§7).

---

## 13. Riscos

1. **Maior risco: a atomicidade depende de a Parte 2 realmente usar `gravarComHistorico`
   em vez do `.update()` direto em TODOS os pontos de escrita de `obras_obra`.** Se um
   caminho novo da J4 escrever direto (ex.: um atalho não previsto aqui), aquele campo
   muda sem deixar rastro, silenciosamente — sem erro, sem teste que pegue isso, porque a
   Parte 1 não tem visibilidade sobre o código da Parte 2 ainda. Mitigação sugerida para
   quem escrever a Parte 2: um teste de integração (ou grep de CI) que falhe se
   `_actions.ts` tiver uma chamada a `.from('obras_obra').update(` fora de
   `gravarComHistorico`/`obras_aplicar_alteracao` — fica registrado aqui como
   recomendação, não implementado neste plano.
2. **A lista fechada de `campo`/`bloco` (check constraint) precisa de migration toda vez
   que a Parte 2 descobrir um campo novo a rastrear** que este documento não previu (ex.:
   se a J4 decidir que `bloqueio` também deveria gerar histórico). Baixo risco — é o
   comportamento desejado (§6), só custa uma migration pequena depois.
3. **`security invoker` na RPC significa que ela herda a RLS de `obras_obra` e
   `obras_historico` — se uma dessas RLS mudar de forma incompatível no futuro (ex.: passa
   a exigir uma coluna nova em `with check`), a RPC pode começar a falhar sem que ninguém
   tenha tocado nela.** Não é um risco novo deste desenho (toda leitura/escrita do módulo
   já depende de `obras_has_access()`), mas vale registrar porque a RPC concentra DOIS
   pontos de escrita numa função só.
4. **`jsonb_populate_record(o, p_campos)` com uma lista estática de colunas (§5) precisa
   ser mantida em sincronia manualmente se `obras_obra` ganhar colunas novas elegíveis a
   este caminho de escrita** — outra migration squeeze quando isso acontecer. Documentado
   aqui para não ser descoberto como bug em produção.
5. **Teste real da RPC exige banco.** Como o resto do módulo, os testes Jest de
   `linhasDeAlteracao` não tocam Supabase (função pura). A RPC em si só é verificável de
   verdade rodando contra o Postgres real — o plano de implementação (arquivo irmão)
   cobre isso com o SQL de verificação no padrão do `RUNBOOK-ir-ao-ar.md`, mas continua
   sendo verificação manual pós-deploy, não CI automatizado (mesma limitação que já vale
   para as migrations anteriores deste módulo).
