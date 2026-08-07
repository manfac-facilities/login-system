# Gestão de Frotas — Track C sub-projeto 1 (integridade de dados) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fecha os 3 achados de maior risco silencioso do Track C (B-13, B-06, B-18) movendo 3 sequências de escrita multi-tabela/leitura-então-escrita da aplicação para dentro de functions atômicas do Postgres.

**Architecture:** 3 functions SQL novas (`plpgsql`, `security definer`, mesmo padrão de `sdd-sql-v04-seguranca.sql`), cada uma substituindo uma sequência de chamadas Supabase separadas por uma única chamada `supabase.rpc(...)`. Nenhuma mudança de schema, nenhuma mudança de assinatura pública das 3 Server Actions afetadas — só a implementação interna delas muda.

**Tech Stack:** Next.js 16 App Router (Server Actions), Supabase (Postgres, RPC via `supabase.rpc()`), TypeScript, Jest.

## Global Constraints

- As 3 functions usam `security definer` + `set search_path = public, pg_catalog`, mesmo padrão já estabelecido em `sdd-sql-v04-seguranca.sql` — copiar esse padrão, não inventar um novo.
- Nenhuma function faz checagem de admin/permissão — isso continua em JS, ANTES da chamada RPC, exatamente como já acontece hoje (as functions são `security definer`, ou seja, rodam com privilégio elevado e ignoram RLS — a Server Action é a única barreira de autorização, então a checagem de admin não pode sumir).
- Mensagens de erro das functions (`RAISE EXCEPTION`) devem ser idênticas, palavra por palavra, às mensagens que a action já mostra hoje pro usuário (quando aplicável) — não é pra mudar texto visível sem necessidade.
- As 3 Server Actions mantêm exatamente a mesma assinatura pública (mesmos parâmetros de entrada, mesmo formato de retorno `State`/`throw`) — nenhuma tela (formulário, listagem) precisa mudar.

---

## Task 1: SQL das 3 functions atômicas

**Files:**
- Create: `sdd-sql-track-c-integridade.sql`

**Interfaces:**
- Produces: `public.lancar_km_atomico(p_equipe_id uuid, p_veiculo_id uuid, p_motorista_id uuid, p_km_atual integer, p_data date, p_observacoes text) returns void`
- Produces: `public.atribuir_responsabilidade_veiculo(p_veiculo_id uuid, p_equipe_id uuid, p_motorista_id uuid, p_tipo text, p_checklist_id uuid) returns void`
- Produces: `public.excluir_multas_em_massa(p_ids uuid[], p_usuario_id uuid) returns setof public.multas`

- [ ] **Step 1: Criar o arquivo SQL com as 3 functions**

```sql
-- sdd-sql-track-c-integridade.sql
-- Track C sub-projeto 1 (integridade de dados): move 3 sequências de
-- escrita multi-tabela/leitura-então-escrita, hoje feitas em passos
-- separados pela aplicação, para dentro de functions atômicas do
-- Postgres. Rodar manualmente no Supabase Dashboard (projeto
-- iyytcavcgukfjnjjrerx) ANTES do deploy do código desta spec — as
-- Server Actions passam a chamar essas functions via supabase.rpc().
--
-- ORDEM OBRIGATÓRIA — este arquivo é o ÚLTIMO da fila. Depende de:
--   1. sdd-sql-v04.sql            → cria a constraint unique (data, veiculo_id)
--                                   usada pelo "on conflict" de lancar_km_atomico
--   2. sdd-sql-v04-seguranca.sql  → cria sofia_has_access()/sofia_is_admin(),
--                                   usadas nas guardas abaixo, e derruba o
--                                   NOT NULL de audit_log.acao/dados, sem o
--                                   qual excluir_multas_em_massa falha
--   3. sdd-sql-track-b.sql        → (independente destas functions, mas também
--                                   pendente; rodar antes do deploy)
--   4. este arquivo
-- Idempotente: são 3 "create or replace function", pode rodar quantas vezes
-- precisar.
--
-- SEGURANÇA: as 3 functions são "security definer", ou seja, ignoram RLS.
-- O PostgREST expõe toda function do schema public como endpoint /rpc/, e o
-- Postgres concede EXECUTE a PUBLIC por padrão — sem as guardas e o
-- revoke/grant do fim deste arquivo, qualquer usuário autenticado do Hub
-- (mesmo sem acesso liberado ao sofia) chamaria estas functions direto do
-- navegador, reabrindo os achados B-01/B-04 fechados no pacote de segurança.
--
-- Erros de regra de negócio usam o SQLSTATE customizado 'SOF01' — é assim que
-- a Server Action distingue "mensagem que pode ser mostrada ao usuário" de
-- erro interno do banco, que vira mensagem genérica.

-- ============================================================
-- 1. lancar_km_atomico (fecha B-13 — race condition no lançamento de KM)
-- ============================================================
create or replace function public.lancar_km_atomico(
  p_equipe_id uuid,
  p_veiculo_id uuid,
  p_motorista_id uuid,
  p_km_atual integer,
  p_data date,
  p_observacoes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_km_atual_veiculo integer;
begin
  if not public.sofia_has_access() then
    raise exception 'Sem acesso ao sistema de Gestão de Frotas';
  end if;

  select km_atual into v_km_atual_veiculo
  from public.veiculos
  where id = p_veiculo_id
  for update;

  if v_km_atual_veiculo is null then
    raise exception 'Veículo não encontrado' using errcode = 'SOF01';
  end if;

  if p_km_atual < v_km_atual_veiculo then
    -- Formata em pt-BR (1.000) pra mensagem ficar idêntica à que a action
    -- montava em JS com toLocaleString('pt-BR').
    raise exception 'KM não pode ser menor que a última KM registrada (% km)',
      replace(trim(to_char(v_km_atual_veiculo, '999G999G999')), ',', '.')
      using errcode = 'SOF01';
  end if;

  insert into public.km_diario (equipe_id, veiculo_id, motorista_id, km_atual, data, observacoes)
  values (p_equipe_id, p_veiculo_id, p_motorista_id, p_km_atual, p_data, p_observacoes)
  on conflict (data, veiculo_id) do update
    set km_atual = excluded.km_atual,
        equipe_id = excluded.equipe_id,
        motorista_id = excluded.motorista_id,
        observacoes = excluded.observacoes;

  update public.veiculos set km_atual = p_km_atual where id = p_veiculo_id;
end;
$$;

-- ============================================================
-- 2. atribuir_responsabilidade_veiculo (fecha B-06 — reatribuição de
--    equipe/motorista no checklist sem transação)
-- ============================================================
create or replace function public.atribuir_responsabilidade_veiculo(
  p_veiculo_id uuid,
  p_equipe_id uuid,       -- null para devolução/finalização de contrato
  p_motorista_id uuid,    -- pode ser null
  p_tipo text,            -- 'troca' | 'recebimento' | 'devolucao' | 'finalizacao_contrato'
  p_checklist_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoje date := current_date;
begin
  if not public.sofia_has_access() then
    raise exception 'Sem acesso ao sistema de Gestão de Frotas';
  end if;

  perform 1 from public.veiculos where id = p_veiculo_id for update;

  update public.veiculo_responsabilidade_historico
  set fim = v_hoje
  where veiculo_id = p_veiculo_id and fim is null;

  if p_equipe_id is not null then
    insert into public.veiculo_responsabilidade_historico
      (veiculo_id, equipe_id, motorista_id, inicio, origem_checklist_id)
    values (p_veiculo_id, p_equipe_id, p_motorista_id, v_hoje, p_checklist_id);
  end if;

  update public.veiculos
  set equipe_id = p_equipe_id,
      status = case when p_tipo = 'finalizacao_contrato' then 'inativo' else status end
  where id = p_veiculo_id;

  if p_motorista_id is not null and p_equipe_id is not null then
    update public.motoristas set equipe_id = p_equipe_id where id = p_motorista_id;
  end if;
end;
$$;

-- ============================================================
-- 3. excluir_multas_em_massa (fecha B-18 — exclusão em massa sem
--    atomicidade entre delete e audit log)
-- ============================================================
create or replace function public.excluir_multas_em_massa(
  p_ids uuid[],
  p_usuario_id uuid
)
returns setof public.multas
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_multa record;
begin
  if not public.sofia_is_admin() then
    raise exception 'Apenas administradores podem excluir multas';
  end if;

  for v_multa in
    delete from public.multas where id = any(p_ids) returning *
  loop
    insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id)
    values (
      'multas', 'excluiu', v_multa.id::text,
      'Multa excluída em massa — ' || coalesce(v_multa.tipo_infracao, v_multa.descricao, v_multa.id::text),
      p_usuario_id
    );
    return next v_multa;
  end loop;
end;
$$;

-- ============================================================
-- 4. Permissões de execução
--    "create function" concede EXECUTE a PUBLIC por padrão, e o PostgREST
--    expõe /rpc/<function> pra quem tiver token. Tirar de PUBLIC/anon e
--    deixar só "authenticated" — a autorização de verdade é a guarda
--    sofia_has_access()/sofia_is_admin() dentro de cada function.
-- ============================================================
revoke execute on function public.lancar_km_atomico(uuid, uuid, uuid, integer, date, text) from public, anon;
revoke execute on function public.atribuir_responsabilidade_veiculo(uuid, uuid, uuid, text, uuid) from public, anon;
revoke execute on function public.excluir_multas_em_massa(uuid[], uuid) from public, anon;

grant execute on function public.lancar_km_atomico(uuid, uuid, uuid, integer, date, text) to authenticated;
grant execute on function public.atribuir_responsabilidade_veiculo(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.excluir_multas_em_massa(uuid[], uuid) to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add sdd-sql-track-c-integridade.sql
git commit -m "feat(sofia): 3 functions atômicas — lançamento de KM, reatribuição de equipe, exclusão em massa de multas (Track C, B-13/B-06/B-18)"
```

---

## Task 2: `lancarKmAction` usa `lancar_km_atomico`

**Files:**
- Modify: `app/(operacoes)/sofia/km/_actions.ts`
- Modify: `app/(operacoes)/sofia/km/__tests__/_actions.test.ts`

**Interfaces:**
- Consumes: `lancar_km_atomico` (Task 1) via `supabase.rpc('lancar_km_atomico', { p_equipe_id, p_veiculo_id, p_motorista_id, p_km_atual, p_data, p_observacoes })`.

- [ ] **Step 1: Reescrever `lancarKmAction`**

Em `app/(operacoes)/sofia/km/_actions.ts`, trocar o corpo de `lancarKmAction` (linhas 76-125) por:

```ts
export async function lancarKmAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const equipe_id = formData.get('equipe_id') as string
  const veiculo_id = formData.get('veiculo_id') as string
  const motorista_id = (formData.get('motorista_id') as string) || null
  const km_atual = Number(formData.get('km_atual'))
  const data =
    (formData.get('data') as string) || new Date().toISOString().split('T')[0]
  const observacoes = ((formData.get('observacoes') as string) ?? '').trim() || null

  if (!equipe_id || !veiculo_id) return { error: 'Selecione a equipe' }
  const validationError = validateKmAtual(km_atual)
  if (validationError) return { error: validationError }

  const supabase = await createClient()

  const { error } = await supabase.rpc('lancar_km_atomico', {
    p_equipe_id: equipe_id,
    p_veiculo_id: veiculo_id,
    p_motorista_id: motorista_id,
    p_km_atual: km_atual,
    p_data: data,
    p_observacoes: observacoes,
  })

  if (error) {
    // Só as regras de negócio da function (errcode 'SOF01') têm mensagem
    // segura de exibir. Qualquer outro erro do Postgres (constraint, permissão,
    // timeout) vira a mensagem genérica que a action já mostrava antes.
    return { error: error.code === 'SOF01' ? error.message : 'Erro ao registrar KM' }
  }

  revalidatePath('/sofia/km')
  revalidatePath('/sofia/veiculos')
  await logAudit('km_diario', 'criou', null, `KM ${km_atual} km lançado — equipe ${equipe_id} (${data})`)

  // Verificar excedência e criar pendência/desconto automaticamente
  await verificarERegistrarExcedencia(supabase, veiculo_id, data)
  revalidatePath('/sofia/descontos')
  revalidatePath('/sofia/pendencias')

  return { success: true }
}
```

`verificarERegistrarExcedencia` (função auxiliar acima no arquivo) não muda — continua fazendo leituras próprias, chamada depois do lançamento já confirmado atômico.

- [ ] **Step 2: Atualizar o teste**

Em `app/(operacoes)/sofia/km/__tests__/_actions.test.ts`, adicionar `rpc` ao mock do client e trocar o `describe('lancarKmAction — chave de conflito', ...)` (linhas 48-66) por:

```ts
const rpcMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: currentUserEmail ? { email: currentUserEmail } : null },
      })),
    },
    from: jest.fn((table: string) => {
      if (!chains[table]) chains[table] = makeChainable(tableResults[table])
      return chains[table]
    }),
    rpc: rpcMock,
  })),
}))
```

(Adiciona só a linha `rpc: rpcMock,` dentro do objeto retornado por `createClient` — o resto do mock existente, incluindo `makeChainable`/`chains`/`tableResults`, continua igual, ainda usado por `verificarERegistrarExcedencia` e pelas outras actions do arquivo.)

```ts
describe('lancarKmAction — via lancar_km_atomico', () => {
  beforeEach(() => {
    chains = {}
    currentUserEmail = null
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
    tableResults = {
      veiculos: { data: { km_contratual_mensal: null, placa: 'ABC-1234' }, error: null },
      km_diario: { data: [], error: null },
    }
  })

  it('chama lancar_km_atomico com os parâmetros certos', async () => {
    await lancarKmAction(
      {},
      buildFormData({
        equipe_id: 'equipe-1',
        veiculo_id: 'veiculo-1',
        motorista_id: 'motorista-1',
        km_atual: '1500',
        data: '2026-07-18',
        observacoes: 'tudo certo',
      })
    )

    expect(rpcMock).toHaveBeenCalledWith('lancar_km_atomico', {
      p_equipe_id: 'equipe-1',
      p_veiculo_id: 'veiculo-1',
      p_motorista_id: 'motorista-1',
      p_km_atual: 1500,
      p_data: '2026-07-18',
      p_observacoes: 'tudo certo',
    })
  })

  it('surfaces a mensagem de erro exata que a function retorna (regra de KM menor)', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: 'SOF01', message: 'KM não pode ser menor que a última KM registrada (2000 km)' },
    })

    const result = await lancarKmAction(
      {},
      buildFormData({ equipe_id: 'equipe-1', veiculo_id: 'veiculo-1', km_atual: '1500', data: '2026-07-18' })
    )

    expect(result).toEqual({ error: 'KM não pode ser menor que a última KM registrada (2000 km)' })
  })

  it('esconde erro interno do Postgres atrás da mensagem genérica', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied for function lancar_km_atomico' },
    })

    const result = await lancarKmAction(
      {},
      buildFormData({ equipe_id: 'equipe-1', veiculo_id: 'veiculo-1', km_atual: '1500', data: '2026-07-18' })
    )

    expect(result).toEqual({ error: 'Erro ao registrar KM' })
  })

  it('não chama mais select/upsert direto em veiculos ou km_diario para o lançamento em si', async () => {
    await lancarKmAction(
      {},
      buildFormData({ equipe_id: 'equipe-1', veiculo_id: 'veiculo-1', km_atual: '1500', data: '2026-07-18' })
    )

    // A única escrita do lançamento em si é via rpc — chains.veiculos/km_diario
    // só existem por causa de verificarERegistrarExcedencia, chamada DEPOIS.
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Rodar e confirmar**

Run: `npx jest "app/(operacoes)/sofia/km"`
Expected: PASS (inclusive os testes existentes de `deletarKmAction`, `upsertKmExcedidoStatusAction`, `atualizarAutorizacaoKmExcedidoAction`, que não usam `rpc` e continuam iguais)

- [ ] **Step 4: Commit**

```bash
git add "app/(operacoes)/sofia/km/_actions.ts" "app/(operacoes)/sofia/km/__tests__/_actions.test.ts"
git commit -m "feat(sofia): lancarKmAction usa lancar_km_atomico, fecha race condition de KM (B-13)"
```

---

## Task 3: `criarChecklistAction` usa `atribuir_responsabilidade_veiculo`

**Files:**
- Modify: `app/(operacoes)/sofia/checklist/_actions.ts`
- Modify: `app/(operacoes)/sofia/checklist/__tests__/_actions.troca.test.ts`
- Modify: `app/(operacoes)/sofia/checklist/__tests__/_actions.devolucao-finalizacao.test.ts`

**Interfaces:**
- Consumes: `atribuir_responsabilidade_veiculo` (Task 1) via `supabase.rpc('atribuir_responsabilidade_veiculo', { p_veiculo_id, p_equipe_id, p_motorista_id, p_tipo, p_checklist_id })`.

- [ ] **Step 1: Unificar os 4 branches (troca/recebimento/devolucao/finalizacao_contrato) numa chamada RPC**

Em `app/(operacoes)/sofia/checklist/_actions.ts`, trocar o trecho de `const atribuiEquipe = ...` até o fim do `if/else if` (linhas 88-176) por:

```ts
  const atribuiEquipe = tipo === 'troca' || (tipo === 'recebimento' && !!equipe_destino_id)
  const reatribui = atribuiEquipe || tipo === 'devolucao' || tipo === 'finalizacao_contrato'

  if (reatribui) {
    if (atribuiEquipe) {
      const conflito = await validarVinculoEquipeUnico(supabase, equipe_destino_id as string, veiculo_id)
      if (conflito) {
        return { error: conflito, checklistId: id }
      }
    }

    const { error: rpcError } = await supabase.rpc('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: veiculo_id,
      p_equipe_id: atribuiEquipe ? equipe_destino_id : null,
      p_motorista_id: atribuiEquipe ? motorista_destino_id : null,
      p_tipo: tipo,
      p_checklist_id: id,
    })

    if (rpcError) {
      return {
        error: 'Erro ao processar a troca de responsável. O checklist não foi afetado.',
        checklistId: id,
      }
    }

    if (atribuiEquipe) {
      await logAudit('veiculo_responsabilidade_historico', 'criou', null, `Atribuição de equipe: veículo ${veiculo_id} → equipe ${equipe_destino_id}`)
    } else if (tipo === 'devolucao') {
      await logAudit('veiculos', 'atualizou', veiculo_id, `Devolução registrada — veículo ${veiculo_id} sem equipe`)
    } else if (tipo === 'finalizacao_contrato') {
      await logAudit('veiculos', 'desativou', veiculo_id, `Finalização de contrato registrada via checklist — veículo ${veiculo_id}`)
    }
  }
```

O resto da função (`revalidatePath` em diante) não muda.

- [ ] **Step 2: Atualizar `_actions.troca.test.ts`**

Adicionar `rpc: rpcMock` ao mock do client e trocar as asserções que checavam escritas diretas em `veiculo_responsabilidade_historico`/`veiculos` por asserções sobre a chamada `rpc`:

```ts
type TableResult = { data?: unknown; error?: unknown }

let callLog: string[]
const rpcMock = jest.fn()

function makeChainable(table: string, result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['update', 'insert', 'select', 'eq', 'is', 'single', 'neq', 'limit']
  for (const m of methods) {
    chain[m] = jest.fn(() => {
      callLog.push(`${table}.${m}`)
      return chain
    })
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(table, tableResults[table])),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    rpc: rpcMock,
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { criarChecklistAction } from '../_actions'

function buildTrocaFormData(): FormData {
  const fd = new FormData()
  const fields: Record<string, string> = {
    id: 'checklist-1',
    tipo: 'troca',
    equipe_id: 'equipe-origem',
    veiculo_id: 'veiculo-1',
    equipe_destino_id: 'equipe-destino',
    motorista_destino_id: '',
    motorista_id: '',
    observacoes: '',
    assinatura_motorista: 'true',
    lataria_ok: 'true',
    vidros_ok: 'true',
    pneus_ok: 'true',
    combustivel_ok: 'true',
    itens_internos_ok: 'true',
    estepe_ok: 'true',
    macaco_ok: 'true',
    triangulo_ok: 'true',
    fotos: JSON.stringify({
      Frente: { path: 'checklist-1/Frente-1.jpg', lat: null, lng: null },
      Traseira: { path: 'checklist-1/Traseira-1.jpg', lat: null, lng: null },
      'Lateral Esq.': { path: 'checklist-1/Lateral-Esq.-1.jpg', lat: null, lng: null },
      'Lateral Dir.': { path: 'checklist-1/Lateral-Dir.-1.jpg', lat: null, lng: null },
    }),
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('criarChecklistAction — troca de responsável', () => {
  beforeEach(() => {
    callLog = []
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
    tableResults = {
      checklist: { error: null },
      checklist_fotos: { error: null },
      veiculos: { error: null }, // usado só pela leitura de validarVinculoEquipeUnico
    }
  })

  it('reports success and calls atribuir_responsabilidade_veiculo with the right params', async () => {
    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result).toEqual({ success: true, checklistId: 'checklist-1' })
    expect(rpcMock).toHaveBeenCalledWith('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: 'veiculo-1',
      p_equipe_id: 'equipe-destino',
      p_motorista_id: null,
      p_tipo: 'troca',
      p_checklist_id: 'checklist-1',
    })
  })

  it('surfaces an error instead of silently succeeding when the RPC fails', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'lock timeout' } })

    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result).toEqual({
      error: 'Erro ao processar a troca de responsável. O checklist não foi afetado.',
      checklistId: 'checklist-1',
    })
  })

  it('blocks the team handoff when the destination team is already linked to another active vehicle', async () => {
    // Mocks the `veiculos` select used internally by validarVinculoEquipeUnico
    // returning a conflicting row — mirrors the conflict-case mock in
    // app/(operacoes)/sofia/veiculos/__tests__/_actions.test.ts.
    tableResults.veiculos = { data: [{ id: 'veiculo-outro', placa: 'XYZ-9999' }] }

    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result).toEqual({
      error: 'Equipe já vinculada ao veículo XYZ-9999',
      checklistId: 'checklist-1',
    })
    // A validação short-circuita antes da chamada rpc — a reatribuição
    // nunca chega a ser tentada.
    expect(rpcMock).not.toHaveBeenCalled()
    expect(callLog).toContain('veiculos.select')
  })

  it('surfaces the fotos-registration error and keeps the checklist id when checklist_fotos insert fails after the checklist row was already saved', async () => {
    tableResults.checklist_fotos = { error: { message: 'RLS denied' } }

    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result.error).toBeTruthy()
    expect(result.error).toBe(
      'Checklist salvo, mas as fotos não foram registradas. Contate o suporte.'
    )
    expect(result.checklistId).toBe('checklist-1')
    // A falha acontece antes de chegar na reatribuição de equipe — rpc
    // nunca é chamado.
    expect(rpcMock).not.toHaveBeenCalled()
    expect(callLog).not.toContain('checklist.delete')
    expect(callLog).toContain('checklist.insert')
    expect(callLog).toContain('checklist_fotos.insert')
  })
})
```

- [ ] **Step 3: Atualizar `_actions.devolucao-finalizacao.test.ts`**

Mesmo padrão — adicionar `rpc: rpcMock` ao mock, trocar `tableResults` (não precisa mais de `veiculo_responsabilidade_historico`), e trocar as asserções de sucesso/erro pra checar a chamada `rpc`:

```ts
type TableResult = { data?: unknown; error?: unknown }
const rpcMock = jest.fn()

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['update', 'insert', 'select', 'eq', 'is', 'single', 'neq', 'limit']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    rpc: rpcMock,
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { criarChecklistAction } from '../_actions'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    id: 'checklist-1',
    veiculo_id: 'veiculo-1',
    equipe_id: '',
    equipe_destino_id: '',
    motorista_destino_id: '',
    motorista_id: '',
    observacoes: '',
    assinatura_motorista: 'true',
    lataria_ok: 'true',
    vidros_ok: 'true',
    pneus_ok: 'true',
    combustivel_ok: 'true',
    itens_internos_ok: 'true',
    estepe_ok: 'true',
    macaco_ok: 'true',
    triangulo_ok: 'true',
    fotos: JSON.stringify({
      Frente: { path: 'checklist-1/Frente-1.jpg', lat: null, lng: null },
      Traseira: { path: 'checklist-1/Traseira-1.jpg', lat: null, lng: null },
      'Lateral Esq.': { path: 'checklist-1/Lateral-Esq.-1.jpg', lat: null, lng: null },
      'Lateral Dir.': { path: 'checklist-1/Lateral-Dir.-1.jpg', lat: null, lng: null },
    }),
  }
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) fd.set(k, v)
  return fd
}

describe('criarChecklistAction — devolucao', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
    tableResults = { checklist: { error: null }, checklist_fotos: { error: null } }
  })

  it('zera a equipe do veículo e fecha o histórico ao devolver', async () => {
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-1', tipo: 'devolucao', equipe_id: 'equipe-1' }))

    expect(result).toEqual({ success: true, checklistId: 'checklist-1' })
    expect(rpcMock).toHaveBeenCalledWith('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: 'veiculo-1',
      p_equipe_id: null,
      p_motorista_id: null,
      p_tipo: 'devolucao',
      p_checklist_id: 'checklist-1',
    })
  })

  it('surfaces erro se a RPC falhar', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'falhou' } })
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-1', tipo: 'devolucao', equipe_id: 'equipe-1' }))
    expect(result.error).toBe('Erro ao processar a troca de responsável. O checklist não foi afetado.')
  })
})

describe('criarChecklistAction — finalizacao_contrato', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
    tableResults = { checklist: { error: null }, checklist_fotos: { error: null } }
  })

  it('inativa o veículo ao finalizar contrato', async () => {
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-2', tipo: 'finalizacao_contrato' }))

    expect(result).toEqual({ success: true, checklistId: 'checklist-2' })
    expect(rpcMock).toHaveBeenCalledWith('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: 'veiculo-1',
      p_equipe_id: null,
      p_motorista_id: null,
      p_tipo: 'finalizacao_contrato',
      p_checklist_id: 'checklist-2',
    })
  })
})

describe('criarChecklistAction — recebimento com atribuição de equipe', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
    tableResults = { checklist: { error: null }, checklist_fotos: { error: null }, veiculos: { error: null } }
  })

  it('atribui a equipe quando equipe_destino_id vem preenchido', async () => {
    const result = await criarChecklistAction(
      {},
      buildFormData({ id: 'checklist-3', tipo: 'recebimento', equipe_destino_id: 'equipe-2' })
    )

    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
    expect(rpcMock).toHaveBeenCalledWith('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: 'veiculo-1',
      p_equipe_id: 'equipe-2',
      p_motorista_id: null,
      p_tipo: 'recebimento',
      p_checklist_id: 'checklist-3',
    })
  })

  it('não chama a RPC quando equipe_destino_id vem vazio', async () => {
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-3', tipo: 'recebimento' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Rodar e confirmar**

Run: `npx jest "app/(operacoes)/sofia/checklist"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(operacoes)/sofia/checklist/_actions.ts" "app/(operacoes)/sofia/checklist/__tests__/_actions.troca.test.ts" "app/(operacoes)/sofia/checklist/__tests__/_actions.devolucao-finalizacao.test.ts"
git commit -m "feat(sofia): criarChecklistAction usa atribuir_responsabilidade_veiculo, fecha reatribuição sem transação (B-06)"
```

---

## Task 4: `excluirMultasEmMassaAction` usa `excluir_multas_em_massa`

**Files:**
- Modify: `app/(operacoes)/sofia/multas/_actions.ts`
- Modify: `app/(operacoes)/sofia/multas/__tests__/_actions.test.ts`

**Interfaces:**
- Consumes: `excluir_multas_em_massa` (Task 1) via `supabase.rpc('excluir_multas_em_massa', { p_ids, p_usuario_id })`.

- [ ] **Step 1: Reescrever `excluirMultasEmMassaAction`**

Em `app/(operacoes)/sofia/multas/_actions.ts`, trocar o corpo da função (linhas 77-93) por:

```ts
export async function excluirMultasEmMassaAction(ids: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    throw new Error('Apenas administradores podem excluir multas')

  const { error } = await supabase.rpc('excluir_multas_em_massa', {
    p_ids: ids,
    p_usuario_id: user.id,
  })
  if (error) throw error

  revalidatePath('/sofia/multas')
}
```

O loop de `logAudit` some daqui — a function `excluir_multas_em_massa` já grava o audit log de cada multa excluída, na mesma transação do delete (ver Task 1).

- [ ] **Step 2: Atualizar o teste**

Em `app/(operacoes)/sofia/multas/__tests__/_actions.test.ts`, adicionar `rpcMock` ao topo do arquivo e ao mock do client:

```ts
const rpcMock = jest.fn()
```

```ts
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
    from: jest.fn((table: string) => {
      if (table === 'audit_log') return { insert: auditInsertMock }
      return {
        insert: jest.fn(() => ({ select: jest.fn(() => ({ single: multaInsertMock })) })),
        update: jest.fn(() => ({
          in: jest.fn(() => ({ eq: multaUpdateInEqMock })),
          eq: multaUpdateEqMock,
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({ select: jest.fn(() => ({ single: multaDeleteEqSelectSingleMock })) })),
          in: jest.fn(() => ({ select: multaDeleteInSelectMock })),
        })),
      }
    }),
  })),
}))
```

Trocar o `describe('excluirMultasEmMassaAction', ...)` (linhas 199-227) por:

```ts
describe('excluirMultasEmMassaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('calls excluir_multas_em_massa with the ids and the admin user id, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1', email: ADMIN_EMAIL } } })
    await excluirMultasEmMassaAction(['multa-1', 'multa-2'])
    expect(rpcMock).toHaveBeenCalledWith('excluir_multas_em_massa', {
      p_ids: ['multa-1', 'multa-2'],
      p_usuario_id: 'admin-1',
    })
  })

  it('propagates the error when the RPC fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1', email: ADMIN_EMAIL } } })
    rpcMock.mockResolvedValue({ data: null, error: new Error('bulk delete failed') })
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow('bulk delete failed')
  })
})
```

- [ ] **Step 3: Rodar e confirmar**

Run: `npx jest "app/(operacoes)/sofia/multas"`
Expected: PASS (os outros `describe` do arquivo — `criarMultaAction`, `enviarParaDescontoEmMassaAction`, `excluirMultaAction` singular, `atualizarAutorizacaoMultaAction` — não mudam)

- [ ] **Step 4: Rodar a suíte completa + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, sem erros de tipo

- [ ] **Step 5: Commit**

```bash
git add "app/(operacoes)/sofia/multas/_actions.ts" "app/(operacoes)/sofia/multas/__tests__/_actions.test.ts"
git commit -m "feat(sofia): excluirMultasEmMassaAction usa excluir_multas_em_massa, garante audit log atômico (B-18)"
```

---

## Verificação final

```bash
npx tsc --noEmit
npx jest
npx next build
```

**SQL pra João rodar manualmente no Supabase Dashboard (projeto `iyytcavcgukfjnjjrerx`), antes do deploy do código desta spec.** Nenhum destes rodou em produção ainda — a ordem é obrigatória, cada um depende do anterior:

1. `sdd-sql-v04.sql` — cria a constraint `unique (data, veiculo_id)` que o `on conflict` de `lancar_km_atomico` exige.
2. `sdd-sql-v04-seguranca.sql` — cria `sofia_has_access()`/`sofia_is_admin()` (usadas nas guardas das 3 functions novas) e derruba o `NOT NULL` de `audit_log.acao`/`.dados`, sem o qual `excluir_multas_em_massa` falha em toda chamada.
3. `sdd-sql-track-b.sql` — coluna `checklist.itens_problemas`.
4. `sdd-sql-track-c-integridade.sql` (Task 1) — 3 `create or replace function` + `revoke`/`grant`, sem migração de schema, seguro rodar quantas vezes precisar.

**Verificação de segurança pós-migração** (além do checklist de `2026-07-20-checklist-pos-migracao-seguranca.md`): logado como um usuário Manfac **sem** acesso liberado ao sofia, chamar `supabase.rpc('lancar_km_atomico', {...})` pelo console do navegador — deve falhar com "Sem acesso ao sistema de Gestão de Frotas", não gravar nada.

**Verificação manual recomendada após o deploy** (não é testável via mock, só contra Postgres real): abrir 2 abas do navegador, lançar KM pro mesmo veículo quase ao mesmo tempo em cada uma, confirmar que `veiculos.km_atual` final reflete o maior dos dois lançamentos.

**Fora de escopo desta spec:** sub-projetos 2 (performance) e 3 (infra) do Track C — specs separadas, depois desta.
