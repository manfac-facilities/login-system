# Gestão de Frotas — Pacote de Segurança (achados P0/P1 da auditoria)

**Data:** 2026-07-20
**Status:** Em revisão

---

## Contexto

A auditoria de 2026-07-16/17 (relatório completo: https://claude.ai/code/artifact/15375100-f249-4580-bb95-31f94c054848) achou 5 problemas P0 de segurança/integridade no backend do módulo. O achado B-05 (chave do `km_diario`) já foi corrigido na v04. Esta spec cobre os 4 restantes, mais os achados P1 diretamente relacionados a controle de acesso (B-07) e confiabilidade de escrita (B-06, B-08).

Esta é uma mudança que toca autorização em todo o módulo — o risco de regressão (bloquear ação legítima) é tão real quanto o risco de segurança que estamos fechando. Cada mudança de RLS será acompanhada do equivalente client-side já validado por teste, e o `/security-review` será rodado no diff antes de considerar pronto (pedido explícito do dono do projeto).

---

## 1. RLS aberta (achado B-01) + rota de API fora do middleware (achado B-04)

**Problema:** todas as 16 policies do módulo são `using(true)` — qualquer usuário `authenticated` no Supabase (mesmo sem acesso liberado ao sistema "sofia" no Hub) pode ler/escrever qualquer linha via um client Supabase instanciado direto no console do navegador. Separadamente, `/api/sofia/veiculo-motorista` não está no `matcher` do `middleware.ts`, então nem o gate de página funciona pra essa rota.

### Função SQL de acesso

```sql
create or replace function public.sofia_has_access()
returns boolean
language sql
security definer
stable
as $$
  select
    (auth.jwt() ->> 'email') in (
      'ewerton.silva@manfac.com.br',
      'jose.guilherme@manfac.com.br',
      'jvictorco28@gmail.com'
    )
    or exists (
      select 1 from public.hub_system_access
      where user_email = lower(trim(auth.jwt() ->> 'email'))
        and system_slug = 'sofia'
        and has_access = true
    );
$$;
```

Espelha exatamente a lógica de `hasSystemAccess()` (`lib/auth/systemAccess.ts`) e da lista `ADMIN_EMAILS` (`lib/auth/admins.ts`). **Precisa ficar sincronizada manualmente com esses dois arquivos** — comentário no SQL avisando isso.

### Substituir as 16 policies

Cada uma das 16 tabelas do módulo (`equipes`, `veiculos`, `motoristas`, `km_diario`, `checklist`, `checklist_fotos`, `multas`, `sinistros`, `sinistro_fotos`, `revisoes`, `documentos_veiculo`, `abastecimentos`, `motorista_documentos`, `veiculo_responsabilidade_historico`, `centro_custo_historico`, `pendencias`) troca `using(true) with check(true)` por `using(sofia_has_access()) with check(sofia_has_access())`.

### Função de admin (pra achado B-03/B-07 abaixo)

```sql
create or replace function public.sofia_is_admin()
returns boolean
language sql
security definer
stable
as $$
  select (auth.jwt() ->> 'email') in (
    'ewerton.silva@manfac.com.br',
    'jose.guilherme@manfac.com.br',
    'jvictorco28@gmail.com'
  );
$$;
```

### Trigger de defesa em profundidade pras colunas de autorização financeira

```sql
create or replace function public.sofia_bloquear_autorizacao_nao_admin()
returns trigger
language plpgsql
security definer
as $$
begin
  if not public.sofia_is_admin() then
    if TG_TABLE_NAME = 'multas' and (
      new.autorizacao_status is distinct from old.autorizacao_status
      or new.valor_descontado is distinct from old.valor_descontado
      or new.status is distinct from old.status
    ) then
      raise exception 'Apenas administradores podem alterar autorização/desconto de multas';
    end if;
    if TG_TABLE_NAME = 'sinistros' and (
      new.autorizacao_status is distinct from old.autorizacao_status
      or new.valor_descontado is distinct from old.valor_descontado
      or new.status_desconto is distinct from old.status_desconto
    ) then
      raise exception 'Apenas administradores podem alterar autorização/desconto de sinistros';
    end if;
    if TG_TABLE_NAME = 'km_excedido_desconto' and (
      new.autorizacao_status is distinct from old.autorizacao_status
    ) then
      raise exception 'Apenas administradores podem alterar autorização de KM excedido';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_bloquear_autorizacao_multas
  before update on public.multas
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

create trigger trg_bloquear_autorizacao_sinistros
  before update on public.sinistros
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

create trigger trg_bloquear_autorizacao_km_excedido
  before update on public.km_excedido_desconto
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();
```

### `middleware.ts`

Adicionar `/api/sofia/:path*` ao array `matcher`. Além disso, `app/api/sofia/veiculo-motorista/route.ts` passa a checar sessão + acesso diretamente (defesa em profundidade, não depender só do middleware):

```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
const acesso = await hasSystemAccess(supabase, user.email, 'sofia')
if (!acesso) return NextResponse.json({ error: 'Sem acesso ao sistema' }, { status: 403 })
```

---

## 2. Desconto salarial sem gate + valor sem validação (achado B-03) + gates inconsistentes (achado B-07)

### Helper único

```ts
// lib/auth/requireAdmin.ts
import { isAdminEmail } from './admins'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function requireAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email)) {
    return 'Apenas administradores podem executar esta ação'
  }
  return null
}
```

Aplicado (checando o retorno antes de prosseguir, retornando `{ error }` se não-nulo) nas actions que hoje não têm gate:
- `registrarDescontoMultaAction`, `registrarDescontoSinistroAction`, `desfazerDescontoMultaAction`, `desfazerDescontoSinistroAction`, `atualizarStatusMultaAction`, `atualizarStatusDescontoSinistroAction` (`descontos/_actions.ts`)
- `atualizarAutorizacaoMultaAction` (`multas/_actions.ts`), `atualizarAutorizacaoSinistroAction` (`sinistros/_actions.ts`)
- `upsertKmExcedidoStatusAction`, `atualizarAutorizacaoKmExcedidoAction` (`km/_actions.ts`)
- `enviarParaDescontoEmMassaAction` (`multas/_actions.ts`)
- `deletarAbastecimentoAction` (`abastecimento/_actions.ts`), `deletarKmAction` (`km/_actions.ts`)
- `toggleEquipeAction` (`equipes/_actions.ts`) — já reduzido a só "reativar" na v04; mesmo assim ganha o gate por consistência
- `atualizarLocacaoVeiculoAction` (`veiculos/_actions.ts`), `atualizarCentroCustoAction`

Ações que já tinham gate inline continuam como estão (não trocar por `requireAdmin()` só por trocar — YAGNI; o helper é pra quem não tem gate nenhum hoje).

### Validação de valor em `parseDescontoFormData`

```ts
const valor_descontado = Number(formData.get('valor_descontado'))
if (Number.isNaN(valor_descontado) || valor_descontado < 0) {
  return { error: 'Valor do desconto inválido' }
}
if (valor_descontado > valorOriginal) {
  return { error: 'Valor do desconto não pode ser maior que o valor original' }
}
```

`valorOriginal` precisa ser buscado (select da multa/sinistro antes de aceitar o desconto) — hoje `parseDescontoFormData` não tem acesso a isso, então essa validação entra na action, não no parser puro.

---

## 3. Log de auditoria quebrado (achado B-02)

**Causa:** duas funções (`registrarAuditoria` e `logAudit`) gravando em `audit_log` com schemas diferentes; `logAudit` viola `NOT NULL` em `acao`/`dados` e falha silenciosamente; a tela filtra `.not('operacao','is',null)`, escondendo o que `registrarAuditoria` grava.

### Migração

```sql
alter table public.audit_log alter column acao drop not null;
alter table public.audit_log alter column dados drop not null;
```

### Unificar em uma função só

`logAudit(tabela, operacao, registroId, descricao)` vira a única função (é a mais usada, 4 dos 5 call sites já são dela). `registrarAuditoria` é removida; o único call site (`multas/_actions.ts`, ações de exclusão) migra pra `logAudit` com `operacao: 'excluiu'`.

```ts
// lib/sofia/auditLog.ts — versão final, substitui o arquivo inteiro
import { createClient } from '@/lib/supabase/server'

type Operacao = 'criou' | 'atualizou' | 'excluiu' | 'desativou'

export async function logAudit(
  tabela: string,
  operacao: Operacao,
  registroId: string | null,
  descricao: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('audit_log').insert({
      tabela,
      operacao,
      registro_id: registroId,
      descricao,
      usuario_id: user?.id ?? null,
    })
    if (error) console.error('logAudit falhou:', error)
  } catch (error) {
    console.error('logAudit falhou:', error)
  }
}
```

### Tela `/sofia/audit`

Remove o filtro `.not('operacao','is',null)` — agora toda escrita usa o mesmo formato, não precisa filtrar.

---

## Fora de escopo desta spec (pacotes seguintes)

- Achado B-06 (transações via RPC) e B-08 (erro descartado em `queries.ts`) — pacote de confiabilidade/P1 backend, próxima spec.
- Achados P0 de UX (U-02, U-03) — pacote de checklist/fotos, próxima spec.

## Testes

- `lib/auth/__tests__/requireAdmin.test.ts` (novo): admin passa, não-admin retorna mensagem.
- Testes existentes de cada action ganham um caso a mais só onde o gate é novo (não-admin bloqueado) — não duplicar os que já testam isso.
- `lib/sofia/__tests__/auditLog.test.ts`: atualizar pra refletir a função unificada (só `logAudit`).
- SQL (RLS, triggers) não é testável por Jest — validação é manual, feita por João depois de rodar no Supabase, seguindo um checklist que a task final do plano vai gerar.
