# Spec técnica — papel "gestor de frotas" no Gestão de Frotas (Sofia) — 26/10/2026

**Decisão que esta spec implementa (não rediscutir):** `docs/frotas/2026-10-26-decisoes-joao.md`, seção D2 —
"igor tem acesso total ao frotas, mas nao aos outros sistemas". Ou seja, opção B de
`docs/frotas/2026-10-23-diagnostico-permissoes.md` §4: um papel que, **dentro do Sofia**, pode tudo o que hoje só o
`administrador` do hub pode (os 15 itens do §5, inclusive desconto em salário e exclusões), e **nada fora dele**
(não concede acesso, não abre `/admin/acessos`, não é admin em Obras, CRM, Cockpit etc.).

**Território:** autorização + dinheiro (desconto em salário) + exclusão de dado de cliente — três das cinco exceções do
`AGENTS.md`. Aqui a defesa redundante é obrigatória, não excesso.

**Método:** leitura do código e dos `.sql` do repositório em 26/10/2026 (`master` em `aa375f4`). **Nada foi conferido
no banco de produção** (ver §6). Números de linha valem para `master` `aa375f4`; o branch paralelo de
"mensagens Somente administradores" (§3.4) vai deslocá-los — o implementador confere pelo nome da função.

---

## 0. Resumo

| Camada | Hoje | Depois |
|---|---|---|
| Onde o papel mora | — | tabela nova `public.sofia_gestores` (uma linha por e-mail), sem policy, sem grant para `anon`/`authenticated` |
| Pergunta "pode gerir frotas?" | `sofia_is_admin()` no banco, `isAdmin`/`requireAdmin` no app | **uma** função no banco, `public.sofia_pode_gerir()`; o app pergunta a ela por RPC (`lib/sofia/permissoes.ts`) |
| Regra | admin do hub | admin do hub **OU** (linha em `sofia_gestores` **E** `hub_system_access` `sofia`/`has_access = true`) |
| Triggers | `sofia_bloquear_autorizacao_nao_admin`, `sofia_bloquear_escrita_nao_admin` checam `sofia_is_admin()` | mesmas funções, mesmos 8 triggers, checam `sofia_pode_gerir() is not true` |
| RPC `excluir_multas_em_massa` | `sofia_is_admin() is not true` | `sofia_pode_gerir() is not true` |
| RLS `sofia access` (18 tabelas) | `(select sofia_has_access())` | **não muda** |
| `hub_user_roles`, `hub_system_access`, `/admin/acessos`, `middleware.ts`, Obras, CRM | — | **não mudam** (só a limpeza de usuário em `app/admin/_actions.ts` ganha uma tabela, §3.5) |
| Como o admin concede | — | **só SQL** pelo PAT/SQL Editor, por enquanto (§1.4) |

---

## 1. Modelo de dados

### 1.1 O que existe hoje (lido dos arquivos)

- `hub_user_roles` (`sdd-sql-admin-usuarios.sql:17-24`): `user_email text NOT NULL UNIQUE`, `nivel text NOT NULL CHECK
  (nivel IN ('analista','administrador'))`, `granted_by`. Policy única `authenticated read` (SELECT, `:33-35`). Escrita
  só service role.
- `hub_system_access` (`sdd-sql-conversor-os.sql:24-32`): `user_email`, `system_slug`, `has_access boolean NOT NULL
  DEFAULT true`, `granted_by`, `UNIQUE (user_email, system_slug)`. Policy única `authenticated read` (PARTE 2,
  `sdd-sql-admin-usuarios.sql:64-67`, aplicada em 10/08/2026).
- Funções de autorização: `sofia_is_admin()` e `sofia_has_access()` (`sdd-sql-v04-seguranca.sql:53-84`),
  `obras_is_admin()`/`obras_has_access()` (`sdd-sql-obras-v0.sql:303-336`), `hub_tem_acesso_sistema(text)`
  (`sdd-sql-hub-comunicados.sql:100-122`). Todas `exists(...)`, security definer, `search_path = pg_catalog, public`.
- O nível é lido no app por `lib/auth/roles.ts:31` (`getNivel`, filtra por `NIVEIS = ['analista','administrador']`,
  `:6`) e `:42` (`isAdmin`); o acesso por sistema por `lib/auth/systemAccess.ts:3` (`hasSystemAccess`).

### 1.2 Opções avaliadas

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **A. Novo valor de `nivel`** (`'gestor_frotas'` em `hub_user_roles`) | alterar o CHECK; `roles.ts` passa a reconhecer o valor | nenhuma tabela nova; tela `/admin/acessos` já edita `nivel` | `nivel` é **do hub inteiro** e único por e-mail (UNIQUE): mistura papel de um sistema com o nível global — exatamente o defeito que a decisão D2 quer evitar. Mexe em `hub_user_roles` (exceção 2), no CHECK, em `getNivel`/`NIVEIS`, no seletor de nível da tela e em `alterarNivelAction`/`contarAdministradores`. Um gestor deixa de ser "analista" e todo código que compare `nivel` passa a ter um terceiro caso. Um futuro "gestor de obras" não cabe (um nível por pessoa). |
| **B. Coluna de papel em `hub_system_access`** (`papel text null`, ex. `'gestor'` na linha `sofia`) | `alter table add column`; função lê `papel = 'gestor'` | papel por sistema, genérico | Mexe na tabela de acesso de **todos** os sistemas (exceção 2), lida pelo `middleware.ts` em toda requisição e escrita por `alternarAcessoAction` (`app/admin/_actions.ts:303-325`) e `convidarUsuarioAction` (`:229`). Abstração para um único caso (regra do projeto: abstrair com 3+ usos). Rollback = `drop column` numa tabela crítica. |
| **C. Tabela própria `sofia_gestores`** | tabela nova, uma linha por e-mail; função nova lê ela + `hub_system_access` | **Isolada**: não toca nenhuma tabela, policy ou código que outro sistema use. Nenhum risco de regressão em Obras/CRM/Admin. Rollback = `drop table`. Ausência de linha = não é gestor (falha fechado). | Uma tabela a mais; concessão por SQL até existir tela. |

### 1.3 Recomendação: **C — `public.sofia_gestores`**

Por quê: é a menor mudança que **não encosta** em `hub_user_roles`/`hub_system_access` (as duas tabelas de onde
vieram os dois incidentes de autorização do projeto) e que **não pode**, por construção, dar poder fora do Sofia —
nenhuma função de outro sistema lê essa tabela. A e B espalham o papel por estruturas que o hub inteiro consulta.

Desenho:

```sql
create table if not exists public.sofia_gestores (
  user_email text primary key
    constraint sofia_gestores_email_normalizado
      check (user_email = lower(trim(user_email)) and user_email <> ''),
  granted_by text not null,
  created_at timestamptz not null default now()
);
```

- **E-mail normalizado no CHECK:** a função compara com `lower(trim(auth.jwt() ->> 'email'))`. Um insert à mão com
  maiúscula seria rejeitado na hora, em vez de "conceder" e não funcionar (falharia fechado, mas em silêncio).
- **O papel sozinho não basta:** `sofia_pode_gerir()` exige **também** `hub_system_access` `sofia` com `has_access =
  true`. Assim, tirar o acesso ao Sofia em `/admin/acessos` (toggle existente) tira o papel junto — o admin não
  precisa lembrar de uma segunda tabela para revogar. E conceder o papel a quem não tem o slug não abre nada.
- **Sem FK para `auth.users`:** o projeto inteiro chaveia autorização por e-mail (`hub_user_roles`,
  `hub_system_access`). Órfão é tratado na limpeza de usuário (§3.5).

### 1.4 Quem concede e retira — e como

**Só o administrador do hub, e só por fora do navegador.** Três barreiras independentes:

1. **RLS ligada e nenhuma policy** em `sofia_gestores` (nem SELECT): o app não precisa ler a tabela — ele pergunta à
   função security definer. A migration ainda **dropa qualquer policy** que exista nela (laço sobre `pg_policies`),
   para que uma reaplicação não herde uma policy criada à mão.
2. **`revoke all ... from public, anon, authenticated`**: mesmo que alguém crie uma policy no futuro, o client do
   navegador não tem privilégio de tabela. (Mesmo padrão de `hub_comunicados`, `sdd-sql-hub-comunicados.sql:17-22`.)
3. **Gestor não ganha nada em `hub_system_access`/`hub_user_roles`**: essas tabelas não mudam (continuam só com
   `authenticated read`). O teste (§4.2) prova que o gestor não se concede o slug de outro sistema nem se promove.

Lembrete do incidente: até 10/08/2026 `hub_system_access` tinha policy `ALL` com `with_check = true` e qualquer
logado se concedia acesso pelo navegador (`.claude/rules/acesso-e-admin.md`). **Nenhuma policy de escrita em
`sofia_gestores`, nunca** — nem "só admin": policy de escrita para admin pelo client é desnecessária (a tela usaria
service role, como `app/admin/_actions.ts`) e é superfície a mais.

**Como conceder (recomendação mínima: SQL, sem tela).** É um usuário (Igor) e a decisão é rara. Uma tela em
`/admin/acessos` exigiria UI, action com `exigirAdmin` + service role, testes e revisão — fica registrada em
`docs/DIVIDAS.md` para quando houver um segundo gestor ou pedido do João. Comandos (rodar como `postgres`, PAT ou
SQL Editor, projeto `iyytcavcgukfjnjjrerx`):

```sql
-- Conceder (confirme antes o e-mail exato em auth.users e que há linha sofia/has_access=true):
insert into public.sofia_gestores (user_email, granted_by)
values (lower(trim('<email-do-igor>@manfac.com.br')), 'joao (decisao D2 26/10/2026)')
on conflict (user_email) do nothing;

-- Retirar:
delete from public.sofia_gestores where user_email = lower(trim('<email>'));

-- Conferir:
select g.user_email, g.granted_by, g.created_at,
       a.has_access as tem_slug_sofia, r.nivel
from public.sofia_gestores g
left join public.hub_system_access a on a.user_email = g.user_email and a.system_slug = 'sofia'
left join public.hub_user_roles r on r.user_email = g.user_email;
```

---

## 2. Função de banco `public.sofia_pode_gerir()`

Nome no padrão `sofia_*` das irmãs (`sofia_is_admin`, `sofia_has_access`).

```sql
create or replace function public.sofia_pode_gerir()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select coalesce(
    public.sofia_is_admin()
    or (
      exists (
        select 1 from public.sofia_gestores g
        where g.user_email = lower(trim(auth.jwt() ->> 'email'))
      )
      and exists (
        select 1 from public.hub_system_access a
        where a.user_email = lower(trim(auth.jwt() ->> 'email'))
          and a.system_slug = 'sofia'
          and a.has_access = true
      )
    ),
    false
  );
$$;

revoke all on function public.sofia_pode_gerir() from public, anon;
grant execute on function public.sofia_pode_gerir() to authenticated;
```

- Sempre `true`/`false`: `exists` nunca é NULL e `sofia_is_admin()` também é `exists`; o `coalesce` externo é a
  segunda camada contra um refactor futuro de `sofia_is_admin`. JWT sem e-mail → `user_email = NULL` → `exists`
  falso → `false`.
- `security definer` porque `sofia_gestores` não tem policy nem grant para `authenticated`.
- `authenticated` executa porque o app chama por RPC (§3.1). Expor por `/rpc/` não vaza nada: a função só responde
  sobre **quem chama** (identidade do JWT, sem parâmetro de e-mail).

### 2.1 Cada checagem de admin do Sofia no banco que troca

Levantadas por `grep sofia_is_admin` em todos os `*.sql` da raiz: as **únicas** chamadas fora da definição e de
`sofia_has_access` são estas três. A RLS (`sofia access`) não checa admin e **não muda**.

| # | Função | Arquivo:linha hoje | Linha da guarda | Muda para |
|---|---|---|---|---|
| 1 | `sofia_bloquear_autorizacao_nao_admin()` (triggers `trg_bloquear_autorizacao_multas` `:238-241`, `_sinistros` `:243-246`, `_km_excedido` `:248-251`) | `sdd-sql-v04-seguranca.sql:165-236` | `:172` `if not public.sofia_is_admin() then` | `if public.sofia_pode_gerir() is not true then` + 7 mensagens "Apenas administradores ou gestores de frotas…" |
| 2 | `sofia_bloquear_escrita_nao_admin()` (triggers `trg_bloquear_escrita_equipes` `:301-304`, `_veiculos` `:306-309`, `_centro_custo` `:311-314`, `_abastecimentos` `:316-319`, `_km_diario` `:321-324`) | `sdd-sql-v04-seguranca.sql:260-299` | `:267` `if not public.sofia_is_admin() then` | idem + 5 mensagens |
| 3 | `excluir_multas_em_massa(uuid[])` | `sdd-sql-track-c-integridade.sql:186-216` | `:197` `if public.sofia_is_admin() is not true then` | `if public.sofia_pode_gerir() is not true then` |

**Não mudam** (decisão consciente): `sofia_has_access()` (`:69-84`, gestor já precisa do slug), as guardas
`sofia_has_access() is not true` de `lancar_km_atomico` (`track-c:87`) e `atribuir_responsabilidade_veiculo`
(`track-c:143`), as 18 policies `sofia access`, `obras_is_admin`, `hub_tem_acesso_sistema`.

Os nomes `..._nao_admin` ficam (trocar o nome obrigaria recriar os 8 triggers; o comentário da função registra que
"admin" agora quer dizer "pode gerir frotas"). Os corpos são reescritos **inteiros**, preservando o `if` externo por
tabela (armadilha 42703, `.claude/rules/sql.md`) — o texto está na migration (§4.1).

As mensagens do banco **não chegam ao usuário** (as actions trocam por texto próprio, ex. `km/_actions.ts:139`;
só `SOF01` é repassado, `km/_actions.ts:111`), então trocar o texto não quebra nada no app. Mas elas aparecem para
quem edita pelo SQL Editor (limitação documentada em `.claude/rules/sofia.md` e `sql.md`, que continua valendo:
`postgres`/`service_role` não têm JWT e continuam barrados — o teste (p1) prova).

---

## 3. App

### 3.1 Helper novo: `lib/sofia/permissoes.ts`

Fica em `lib/sofia/` (não em `lib/auth/`) porque é regra **do Sofia**; `lib/auth/` continua sendo o nível do hub.

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export const MSG_SEM_PERMISSAO_FROTAS =
  'Apenas administradores ou gestores de frotas podem executar esta ação'

/**
 * Pergunta ao banco (sofia_pode_gerir) — a MESMA função que os triggers usam.
 * App e banco nunca divergem: não há segunda cópia da regra em TypeScript.
 * Falha FECHADO: erro de RPC, data null ou qualquer coisa que não seja
 * exatamente `true` vira false.
 */
export async function podeGerirFrotas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<boolean> {
  const { data, error } = await supabase.rpc('sofia_pode_gerir')
  if (error) return false
  return data === true
}

export async function requireGestorFrotas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return MSG_SEM_PERMISSAO_FROTAS
  return (await podeGerirFrotas(supabase)) ? null : MSG_SEM_PERMISSAO_FROTAS
}
```

Por que RPC e não reler as tabelas em TS: o diagnóstico §4 opção B aponta o risco central — "as duas camadas têm de
mudar juntas, senão uma continua bloqueando". Com a regra num lugar só, não há como o app liberar e o trigger negar
(ou o contrário). Custo: uma ida ao banco por checagem, igual ao `isAdmin` de hoje. O client é o de
`lib/supabase/server.ts` (anon key + cookie da sessão), então `auth.jwt()` é o do usuário.

`lib/auth/requireAdmin.ts` e `lib/auth/roles.ts` **não mudam** (são usados fora do Sofia).

### 3.2 Cada checagem que troca (27 em 11 arquivos + 1 tela)

Caminho base: `app/(operacoes)/sofia/`. Padrão de troca:
- `const erroAdmin = await requireAdmin(supabase)` → `const erroGestor = await requireGestorFrotas(supabase)`
  (mantendo o que a linha seguinte faz com o erro: `return { error }`, `throw`, ou o novo retorno do branch paralelo).
- Inline `if (!user?.email || !(await isAdmin(supabase, user.email))) return { error: 'Apenas administradores podem X' }`
  → `if (!user?.email || !(await podeGerirFrotas(supabase))) return { error: 'Apenas administradores ou gestores de frotas podem X' }`
  (mesmo verbo X de hoje).
- Remover os imports de `@/lib/auth/requireAdmin` e `@/lib/auth/roles` desses arquivos (o teste de §5 T5 garante).

| # | Arquivo:linha | Função | Item do §5 do diagnóstico | Hoje | Mensagem nova |
|---|---|---|---|---|---|
| 1 | `abastecimento/_actions.ts:58-59` | `deletarAbastecimentoAction` | 10 | `requireAdmin` | constante |
| 2 | `checklist/_actions.ts:155-156` | `excluirChecklistAction` | 15 | inline `isAdmin` | "…ou gestores de frotas podem excluir checklists" |
| 3 | `custos/_actions.ts:16-17` | `atualizarCentroCustoAction` | 6 | `requireAdmin` | constante |
| 4 | `descontos/_actions.ts:20-21` | `atualizarStatusMultaAction` | 13 | `requireAdmin` (throw) | constante |
| 5 | `descontos/_actions.ts:33-34` | `registrarDescontoMultaAction` | 13 | idem | constante |
| 6 | `descontos/_actions.ts:57-58` | `desfazerDescontoMultaAction` | 13 | idem | constante |
| 7 | `descontos/_actions.ts:70-71` | `atualizarStatusDescontoSinistroAction` | 13 | idem | constante |
| 8 | `descontos/_actions.ts:83-84` | `registrarDescontoSinistroAction` | 13 | idem | constante |
| 9 | `descontos/_actions.ts:107-108` | `desfazerDescontoSinistroAction` | 13 | idem | constante |
| 10 | `equipes/_actions.ts:34-35` | `toggleEquipeAction` | 2, 3 | `requireAdmin` (retorno silencioso hoje) | constante (ver §3.4) |
| 11 | `equipes/_actions.ts:51-52` | `desativarEquipeAction` | 3 | inline `isAdmin` | "…ou gestores de frotas podem desativar equipes" |
| 12 | `km/_actions.ts:134-135` | `deletarKmAction` | 8 | `requireAdmin` | constante |
| 13 | `km/_actions.ts:156-157` | `upsertKmExcedidoStatusAction` | 12 | `requireAdmin` (silencioso) | constante (§3.4) |
| 14 | `km/_actions.ts:183-184` | `atualizarAutorizacaoKmExcedidoAction` | 12, 13 | `requireAdmin` (silencioso) | constante (§3.4) |
| 15 | `motoristas/_actions.ts:42-43` | `desativarMotoristaAction` | 3 | inline `isAdmin` | "…ou gestores de frotas podem desativar motoristas" |
| 16 | `multas/_actions.ts:44-45` | `enviarParaDescontoEmMassaAction` | 11 | `requireAdmin` (throw) | constante |
| 17 | `multas/_actions.ts:64-65` | `excluirMultaAction` | 14 | inline `isAdmin` | "…ou gestores de frotas podem excluir multas" |
| 18 | `multas/_actions.ts:82-83` | `excluirMultasEmMassaAction` | 14 | inline `isAdmin` (throw) | "…ou gestores de frotas podem excluir multas" |
| 19 | `multas/_actions.ts:101-102` | `atualizarAutorizacaoMultaAction` | 12, 13 | `requireAdmin` (silencioso) | constante (§3.4) |
| 20 | `revisoes/_actions.ts:43-44` | `excluirRevisaoAction` | 15 | inline `isAdmin` | "…ou gestores de frotas podem excluir revisões" |
| 21 | `sinistros/_actions.ts:13-14` | `atualizarAutorizacaoSinistroAction` | 12, 13 | `requireAdmin` (silencioso) | constante (§3.4) |
| 22 | `sinistros/_actions.ts:91-92` | `excluirSinistroAction` | 14 | inline `isAdmin` | "…ou gestores de frotas podem excluir sinistros" |
| 23 | `veiculos/_actions.ts:79-80` | `atualizarLocacaoVeiculoAction` | 4 | `requireAdmin` (throw) | constante |
| 24 | `veiculos/_actions.ts:108-109` | `atualizarEquipeVeiculoAction` | 1 | inline `isAdmin` | "…ou gestores de frotas podem editar a equipe do veículo" |
| 25 | `veiculos/_actions.ts:138-139` | `enviarParaOficinaAction` | 5 | inline `isAdmin` | "…ou gestores de frotas podem enviar veículo para oficina" |
| 26 | `veiculos/_actions.ts:176-177` | `retornarDaOficinaAction` | 5 | inline `isAdmin` | "…ou gestores de frotas podem registrar retorno da oficina" |
| 27 | `veiculos/_actions.ts:205-206` | `definirSubstitutoAction` | 5 | inline `isAdmin` | "…ou gestores de frotas podem definir o veículo substituto" |

**Itens do §5 sem linha aqui, de propósito:** 7 (corrigir KM) e 9 (corrigir abastecimento) **não existem para
ninguém** — são as frentes F2/F3, fora desta spec. Quando forem construídas, a action nova usa
`requireGestorFrotas`/`podeGerirFrotas` desde o primeiro commit (anotar no plano de F2/F3).

**Fora do escopo, de propósito:** `softDeleteVeiculoAction` (`veiculos/_actions.ts:52-70`) não tem trava hoje
(qualquer um com o slug desativa veículo — observação do diagnóstico §5). Esta spec não cria trava nova; se o João
quiser, é outra decisão.

### 3.3 Telas

A única tela do Sofia que esconde o que o usuário não pode é Multas (diagnóstico §2):

- `multas/page.tsx:3` — trocar `import { isAdmin } from '@/lib/auth/roles'` por `import { podeGerirFrotas } from
  '@/lib/sofia/permissoes'`.
- `multas/page.tsx:19` — `const admin = await isAdmin(supabase, userData.user?.email ?? '')` →
  `const podeGerir = await podeGerirFrotas(supabase)`.
- `multas/page.tsx:47` — `isAdmin={admin}` → `podeGerir={podeGerir}`.
- `multas/_table.tsx:23,26` — prop `isAdmin: boolean` → `podeGerir: boolean`; `:85` e `:162` — `{isAdmin && (` →
  `{podeGerir && (`.

As demais telas mostram os botões para todos hoje (por isso existem os erros silenciosos do diagnóstico). Esconder
botões de quem não pode é melhoria de UI separada (o branch paralelo trata as mensagens); **esta spec não muda
visibilidade em outras telas**. Se o branch paralelo (ou `lib/sofia/queries.ts`, que ele está mexendo) passar a
calcular um `isAdmin` para telas, esse valor tem que vir de `podeGerirFrotas` — ver §3.4.

### 3.4 Interação com o branch paralelo (mensagens "Somente administradores…")

Outro agente, em worktree separado, troca retornos silenciosos de multas/sinistros/descontos/equipes/km por mensagem
"Somente administradores…" e mexe em `lib/sofia/queries.ts`. Ordem recomendada: **esta implementação começa depois
do merge dele** (sobreposição nos mesmos arquivos). Ao começar:

1. `grep -rn "Somente administradores\|Apenas administradores\|requireAdmin\|isAdmin" "app/(operacoes)/sofia" lib/sofia components/sofia`
   — toda ocorrência fora de `__tests__` entra na tabela §3.2 (pode haver checagem nova criada por ele).
2. Onde ele escreveu "Somente administradores podem …", o texto vira **"Somente administradores ou gestores de
   frotas podem …"** (mantém o verbo dele; não misturar "Somente"/"Apenas" na mesma tela). Pontos esperados (pelo
   escopo descrito): `equipes/_actions.ts` `toggleEquipeAction` (#10), `km/_actions.ts` `upsertKmExcedidoStatusAction`
   (#13) e `atualizarAutorizacaoKmExcedidoAction` (#14), `multas/_actions.ts` `atualizarAutorizacaoMultaAction`
   (#19), `sinistros/_actions.ts` `atualizarAutorizacaoSinistroAction` (#21), `descontos/_actions.ts` (#4–#9), e o
   que ele tiver posto em `lib/sofia/queries.ts`.
3. Se `lib/sofia/queries.ts` ganhou leitura de nível/admin, troca por `podeGerirFrotas`.

### 3.5 Limpeza de usuário em `/admin/acessos` (única mudança fora do Sofia)

`app/admin/_actions.ts:136-150` (`apagarLinhasDoUsuario`, chamada por `removerUsuarioAction` `:190` e
`cancelarConviteAction` `:283`) apaga `hub_user_roles` e `hub_system_access`. Passa a apagar também
`sofia_gestores` (mesmo `admin` service role, mesmo `.eq('user_email', alvo)`, erro entra no mesmo `if`).
Motivo: o comentário em `:133-135` já explica — linha órfã devolveria o poder num reconvite do mesmo e-mail, e aqui
devolveria **desconto em salário e exclusões** assim que o admin religasse o slug `sofia`. Três linhas; território de
exceção (escrita em acesso), então entra.

**Não muda:** `exigirAdmin` em `app/admin/_actions.ts`, `middleware.ts:103` (`/admin` só para `isAdmin`),
`app/(dashboard)/dashboard/page.tsx:22-35`, `app/obras/**` (`isAdmin`/`requireAdmin` em `diario`, `importar`,
`painel`, `sincronizar`, `tarefas`), `app/crm/page.tsx`. Gestor continua `analista` nesses lugares.

---

## 4. Migration e teste

Dois arquivos novos na raiz, padrão do projeto (`.claude/rules/sql.md`): `begin`/`commit`, seção 0 que aborta,
verificação depois do commit.

- `sdd-sql-sofia-gestor-frotas.sql` — a migration (§4.1).
- `sdd-sql-sofia-gestor-frotas-teste.sql` — teste de comportamento com JWT forjado, termina em erro de propósito
  (rollback garantido), padrão de `sdd-sql-hub-comunicados-teste-rls.sql` (§4.2).

**Ordem de aplicação (obrigatória):** migration → teste → deploy do app → conceder o Igor → fumaça. A migration é
**inerte** até existir linha em `sofia_gestores`: para admin e para não-gestor, `sofia_pode_gerir()` dá o mesmo
resultado que `sofia_is_admin()`. Já o app novo **depende** da função: deployado antes, a RPC falha, `podeGerirFrotas`
devolve `false` (falha fechado) e **até o admin perde as ações do Sofia**. Por isso SQL primeiro.

### 4.1 `sdd-sql-sofia-gestor-frotas.sql` (texto completo)

```sql
-- ============================================================
-- Gestão de Frotas (Sofia) — papel "gestor de frotas" — 2026-10-26
-- Spec: docs/frotas/2026-10-26-spec-gestor-frotas.md
-- Decisão: docs/frotas/2026-10-26-decisoes-joao.md (D2)
-- ============================================================
-- O QUE FAZ
--   (1) cria public.sofia_gestores (quem é gestor de frotas). Sem policy,
--       sem grant para anon/authenticated: escrita e leitura só postgres /
--       service role. Mesmo motivo de hub_system_access (incidente de
--       10/08/2026: policy de escrita aberta = autopromoção pelo navegador).
--   (2) cria public.sofia_pode_gerir(): admin do hub OU (linha em
--       sofia_gestores E hub_system_access sofia/has_access=true). Sempre
--       true/false, nunca NULL.
--   (3) reescreve sofia_bloquear_autorizacao_nao_admin() e
--       sofia_bloquear_escrita_nao_admin() (os 8 triggers continuam os
--       mesmos) trocando "if not sofia_is_admin()" por
--       "if sofia_pode_gerir() is not true".
--   (4) reescreve excluir_multas_em_massa(uuid[]) com a mesma troca.
--
-- O QUE NÃO FAZ: não toca hub_user_roles, hub_system_access, as 18 policies
-- "sofia access", sofia_is_admin(), sofia_has_access(), lancar_km_atomico,
-- atribuir_responsabilidade_veiculo, nem nada de Obras/CRM/Admin.
--
-- INERTE ATÉ A PRIMEIRA LINHA EM sofia_gestores: para admin e não-gestor o
-- resultado é idêntico ao de hoje.
--
-- LIMITAÇÃO MANTIDA: os triggers continuam barrando postgres/service_role
-- (auth.jwt() NULL => sofia_pode_gerir() false). Contorno documentado em
-- .claude/rules/sql.md (disable trigger / corrigir / enable).
--
-- ESTADO: NÃO APLICADO. Projeto iyytcavcgukfjnjjrerx — confirme o ref.
-- Depois de aplicar: rodar sdd-sql-sofia-gestor-frotas-teste.sql.
-- IDEMPOTENTE: create table if not exists, create or replace, drop de
-- policies em laço, revoke/grant repetíveis. A seção 0 aceita tanto o
-- estado antigo (sofia_is_admin) quanto o já migrado (sofia_pode_gerir).
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS E DERIVA — aborta se produção não estiver como os
--    arquivos dizem. Trocar o corpo de uma função que já divergiu do
--    arquivo apagaria a divergência em silêncio.
-- ============================================================
do $$
declare
  v_src text;
  v_n   int;
begin
  -- tabelas de acesso
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'hub_system_access'
                   and column_name = 'system_slug' and data_type = 'text')
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'hub_system_access'
                      and column_name = 'user_email' and data_type = 'text')
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'hub_system_access'
                      and column_name = 'has_access' and data_type = 'boolean')
  then
    raise exception 'hub_system_access sem user_email/system_slug(text)/has_access(boolean) — abortando';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'hub_user_roles'
                   and column_name = 'nivel') then
    raise exception 'hub_user_roles.nivel não existe — abortando';
  end if;

  -- funções que esta migration usa ou reescreve
  if to_regprocedure('public.sofia_is_admin()') is null
     or to_regprocedure('public.sofia_has_access()') is null
     or to_regprocedure('public.sofia_bloquear_autorizacao_nao_admin()') is null
     or to_regprocedure('public.sofia_bloquear_escrita_nao_admin()') is null
     or to_regprocedure('public.excluir_multas_em_massa(uuid[])') is null
  then
    raise exception 'funções do v04-seguranca/track-c ausentes — abortando';
  end if;

  -- os 8 triggers, cada um na tabela certa, ligado à função certa e HABILITADO
  -- (pega trigger esquecido desabilitado pelo contorno do SQL Editor)
  select count(*) into v_n
  from (values
    ('trg_bloquear_autorizacao_multas',      'public.multas',                 'sofia_bloquear_autorizacao_nao_admin'),
    ('trg_bloquear_autorizacao_sinistros',   'public.sinistros',              'sofia_bloquear_autorizacao_nao_admin'),
    ('trg_bloquear_autorizacao_km_excedido', 'public.km_excedido_desconto',   'sofia_bloquear_autorizacao_nao_admin'),
    ('trg_bloquear_escrita_equipes',         'public.equipes',                'sofia_bloquear_escrita_nao_admin'),
    ('trg_bloquear_escrita_veiculos',        'public.veiculos',               'sofia_bloquear_escrita_nao_admin'),
    ('trg_bloquear_escrita_centro_custo',    'public.centro_custo_historico', 'sofia_bloquear_escrita_nao_admin'),
    ('trg_bloquear_escrita_abastecimentos',  'public.abastecimentos',         'sofia_bloquear_escrita_nao_admin'),
    ('trg_bloquear_escrita_km_diario',       'public.km_diario',              'sofia_bloquear_escrita_nao_admin')
  ) as e(tg, tab, fn)
  join pg_trigger t on t.tgname = e.tg and t.tgrelid = to_regclass(e.tab) and not t.tgisinternal
                   and t.tgenabled <> 'D'
  join pg_proc p on p.oid = t.tgfoid and p.proname = e.fn;
  if v_n <> 8 then
    raise exception 'esperados 8 triggers trg_bloquear_* habilitados e ligados às funções certas, achados % — abortando', v_n;
  end if;

  -- deriva dos corpos: mesma guarda (antiga ou nova) e mesmo número de raise
  select prosrc into v_src from pg_proc where oid = to_regprocedure('public.sofia_bloquear_autorizacao_nao_admin()');
  if v_src !~ '(sofia_is_admin|sofia_pode_gerir)\(\)'
     or (length(v_src) - length(replace(v_src, 'raise exception', ''))) / length('raise exception') <> 7
     or position('status_desconto' in v_src) = 0
     or position('km_excedido_desconto' in v_src) = 0
  then
    raise exception 'sofia_bloquear_autorizacao_nao_admin em produção difere do arquivo (esperado 7 raise) — comparar antes de aplicar';
  end if;

  select prosrc into v_src from pg_proc where oid = to_regprocedure('public.sofia_bloquear_escrita_nao_admin()');
  if v_src !~ '(sofia_is_admin|sofia_pode_gerir)\(\)'
     or (length(v_src) - length(replace(v_src, 'raise exception', ''))) / length('raise exception') <> 5
     or position('valor_locacao_mensal' in v_src) = 0
     or position('centro_custo_historico' in v_src) = 0
  then
    raise exception 'sofia_bloquear_escrita_nao_admin em produção difere do arquivo (esperado 5 raise) — comparar antes de aplicar';
  end if;

  select prosrc into v_src from pg_proc where oid = to_regprocedure('public.excluir_multas_em_massa(uuid[])');
  if v_src !~ '(sofia_is_admin|sofia_pode_gerir)\(\) is not true'
     or position('auth.uid()' in v_src) = 0
  then
    raise exception 'excluir_multas_em_massa em produção difere do arquivo — comparar antes de aplicar';
  end if;
end;
$$;


-- ============================================================
-- 1. TABELA sofia_gestores
-- ============================================================
create table if not exists public.sofia_gestores (
  user_email text primary key
    constraint sofia_gestores_email_normalizado
      check (user_email = lower(trim(user_email)) and user_email <> ''),
  granted_by text not null,
  created_at timestamptz not null default now()
);

comment on table public.sofia_gestores is
  'Gestor de frotas: pode, só no Sofia, o que o administrador do hub pode. Vale só com hub_system_access sofia/has_access=true. Escrita só postgres/service role — NUNCA criar policy de escrita (incidente 10/08/2026).';

alter table public.sofia_gestores enable row level security;

-- nenhuma policy: dropa qualquer uma que exista (criada à mão, reaplicação)
do $$
declare v_pol record;
begin
  for v_pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'sofia_gestores'
  loop
    execute format('drop policy %I on public.sofia_gestores', v_pol.policyname);
  end loop;
end;
$$;

-- segunda barreira, independente da RLS: sem privilégio de tabela
revoke all on table public.sofia_gestores from public, anon, authenticated;


-- ============================================================
-- 2. FUNÇÃO sofia_pode_gerir()
-- ============================================================
create or replace function public.sofia_pode_gerir()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select coalesce(
    public.sofia_is_admin()
    or (
      exists (
        select 1 from public.sofia_gestores g
        where g.user_email = lower(trim(auth.jwt() ->> 'email'))
      )
      and exists (
        select 1 from public.hub_system_access a
        where a.user_email = lower(trim(auth.jwt() ->> 'email'))
          and a.system_slug = 'sofia'
          and a.has_access = true
      )
    ),
    false
  );
$$;

revoke all on function public.sofia_pode_gerir() from public, anon;
grant execute on function public.sofia_pode_gerir() to authenticated;


-- ============================================================
-- 3. TRIGGER: autorização/desconto (multas, sinistros, km_excedido_desconto)
--    "admin" no nome = "pode gerir frotas" desde 2026-10-26.
--    IF EXTERNO por tabela: não juntar TG_TABLE_NAME e new.campo num "and"
--    (42703 record "new" has no field — .claude/rules/sql.md).
-- ============================================================
create or replace function public.sofia_bloquear_autorizacao_nao_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.sofia_pode_gerir() is not true then
    if TG_OP = 'UPDATE' then
      if TG_TABLE_NAME = 'multas' then
        if new.autorizacao_status is distinct from old.autorizacao_status
          or new.valor_descontado is distinct from old.valor_descontado
          or new.status is distinct from old.status
        then
          raise exception 'Apenas administradores ou gestores de frotas podem alterar autorização/desconto de multas';
        end if;
      elsif TG_TABLE_NAME = 'sinistros' then
        if new.autorizacao_status is distinct from old.autorizacao_status
          or new.valor_descontado is distinct from old.valor_descontado
          or new.status_desconto is distinct from old.status_desconto
        then
          raise exception 'Apenas administradores ou gestores de frotas podem alterar autorização/desconto de sinistros';
        end if;
      elsif TG_TABLE_NAME = 'km_excedido_desconto' then
        if new.autorizacao_status is distinct from old.autorizacao_status then
          raise exception 'Apenas administradores ou gestores de frotas podem alterar autorização de KM excedido';
        end if;
      end if;
    elsif TG_OP = 'INSERT' then
      if TG_TABLE_NAME = 'multas' then
        if new.autorizacao_status is distinct from 'sem_solicitacao'
          or new.valor_descontado is not null
          or new.status is distinct from 'pendente'
        then
          raise exception 'Apenas administradores ou gestores de frotas podem inserir multas com autorização/desconto já definidos';
        end if;
      elsif TG_TABLE_NAME = 'sinistros' then
        if new.autorizacao_status is distinct from 'sem_solicitacao'
          or new.valor_descontado is not null
          or new.status_desconto is distinct from 'pendente'
        then
          raise exception 'Apenas administradores ou gestores de frotas podem inserir sinistros com autorização/desconto já definidos';
        end if;
      elsif TG_TABLE_NAME = 'km_excedido_desconto' then
        if new.autorizacao_status is distinct from 'sem_solicitacao' then
          raise exception 'Apenas administradores ou gestores de frotas podem inserir KM excedido com autorização já definida';
        end if;
      end if;
    elsif TG_OP = 'DELETE' then
      if TG_TABLE_NAME in ('multas', 'sinistros', 'km_excedido_desconto') then
        raise exception 'Apenas administradores ou gestores de frotas podem excluir este registro';
      end if;
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


-- ============================================================
-- 4. TRIGGER: demais escritas restritas (equipes.ativo,
--    veiculos.valor_locacao_mensal, insert centro_custo_historico,
--    delete abastecimentos/km_diario)
-- ============================================================
create or replace function public.sofia_bloquear_escrita_nao_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.sofia_pode_gerir() is not true then
    if TG_OP = 'UPDATE' then
      if TG_TABLE_NAME = 'equipes' then
        if new.ativo is distinct from old.ativo then
          raise exception 'Apenas administradores ou gestores de frotas podem ativar/desativar equipes';
        end if;
      elsif TG_TABLE_NAME = 'veiculos' then
        if new.valor_locacao_mensal is distinct from old.valor_locacao_mensal then
          raise exception 'Apenas administradores ou gestores de frotas podem alterar o valor de locação do veículo';
        end if;
      end if;
    elsif TG_OP = 'INSERT' then
      if TG_TABLE_NAME = 'centro_custo_historico' then
        raise exception 'Apenas administradores ou gestores de frotas podem atualizar o centro de custo';
      end if;
    elsif TG_OP = 'DELETE' then
      if TG_TABLE_NAME = 'abastecimentos' then
        raise exception 'Apenas administradores ou gestores de frotas podem excluir abastecimentos';
      end if;
      if TG_TABLE_NAME = 'km_diario' then
        raise exception 'Apenas administradores ou gestores de frotas podem excluir lançamentos de KM';
      end if;
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


-- ============================================================
-- 5. RPC excluir_multas_em_massa — mesma assinatura, guarda nova.
--    security definer ignora RLS: a guarda é a ÚNICA proteção.
-- ============================================================
create or replace function public.excluir_multas_em_massa(
  p_ids uuid[]
)
returns setof public.multas
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_multa record;
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem excluir multas';
  end if;

  for v_multa in
    delete from public.multas where id = any(p_ids) returning *
  loop
    insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id)
    values (
      'multas', 'excluiu', v_multa.id::text,
      'Multa excluída em massa — ' || coalesce(v_multa.tipo_infracao, v_multa.descricao, v_multa.id::text),
      auth.uid()
    );
    return next v_multa;
  end loop;
end;
$$;

revoke execute on function public.excluir_multas_em_massa(uuid[]) from public, anon;
grant execute on function public.excluir_multas_em_massa(uuid[]) to authenticated;

commit;


-- ============================================================
-- VERIFICAÇÃO (depois do commit) — uma linha por invariante.
-- Qualquer "*** FALHOU ***" = parar, não deployar.
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'sofia_gestores existe com RLS ligada', 'true',
      (select relrowsecurity::text from pg_class where oid = to_regclass('public.sofia_gestores'))),
  (2, 'sofia_gestores: nenhuma policy', '0',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'sofia_gestores')),
  (3, 'anon e authenticated sem NENHUM privilégio em sofia_gestores', 'false',
      (select (has_table_privilege('anon', 'public.sofia_gestores', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('authenticated', 'public.sofia_gestores', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::text)),
  (4, 'sofia_gestores: colunas', 'created_at,granted_by,user_email',
      (select string_agg(column_name, ',' order by column_name) from information_schema.columns
       where table_schema = 'public' and table_name = 'sofia_gestores')),
  (5, 'sofia_gestores: CHECK de e-mail normalizado existe', '1',
      (select count(*)::text from pg_constraint
       where conrelid = to_regclass('public.sofia_gestores') and conname = 'sofia_gestores_email_normalizado')),
  (6, 'sofia_pode_gerir é security definer', 'true',
      (select prosecdef::text from pg_proc where oid = to_regprocedure('public.sofia_pode_gerir()'))),
  (7, 'sofia_pode_gerir com search_path fixo', 'true',
      (select ('search_path=pg_catalog, public' = any(proconfig))::text
       from pg_proc where oid = to_regprocedure('public.sofia_pode_gerir()'))),
  (8, 'sofia_pode_gerir: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.sofia_pode_gerir()', 'EXECUTE')
            and not has_function_privilege('anon', 'public.sofia_pode_gerir()', 'EXECUTE'))::text)),
  (9, 'sofia_pode_gerir sem JWT devolve false (não NULL)', 'false',
      (select coalesce(public.sofia_pode_gerir()::text, 'NULL'))),
  (10, 'trigger autorizacao usa sofia_pode_gerir() is not true e não sofia_is_admin', 'true',
      (select (position('sofia_pode_gerir() is not true' in prosrc) > 0
            and position('sofia_is_admin' in prosrc) = 0)::text
       from pg_proc where oid = to_regprocedure('public.sofia_bloquear_autorizacao_nao_admin()'))),
  (11, 'trigger escrita usa sofia_pode_gerir() is not true e não sofia_is_admin', 'true',
      (select (position('sofia_pode_gerir() is not true' in prosrc) > 0
            and position('sofia_is_admin' in prosrc) = 0)::text
       from pg_proc where oid = to_regprocedure('public.sofia_bloquear_escrita_nao_admin()'))),
  (12, 'excluir_multas_em_massa usa sofia_pode_gerir() is not true', 'true',
      (select (position('sofia_pode_gerir() is not true' in prosrc) > 0
            and position('sofia_is_admin' in prosrc) = 0)::text
       from pg_proc where oid = to_regprocedure('public.excluir_multas_em_massa(uuid[])'))),
  (13, 'excluir_multas_em_massa: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.excluir_multas_em_massa(uuid[])', 'EXECUTE')
            and not has_function_privilege('anon', 'public.excluir_multas_em_massa(uuid[])', 'EXECUTE'))::text)),
  (14, 'os 8 triggers trg_bloquear_* continuam habilitados', '8',
      (select count(*)::text from pg_trigger
       where tgname like 'trg_bloquear_%' and not tgisinternal and tgenabled <> 'D')),
  (15, 'hub_system_access: policies inalteradas (só SELECT)', 'SELECT:{authenticated}',
      (select coalesce(string_agg(cmd || ':' || roles::text, ', ' order by cmd), '(nenhuma)')
       from pg_policies where schemaname = 'public' and tablename = 'hub_system_access')),
  (16, 'hub_user_roles: policies inalteradas (só SELECT)', 'SELECT:{authenticated}',
      (select coalesce(string_agg(cmd || ':' || roles::text, ', ' order by cmd), '(nenhuma)')
       from pg_policies where schemaname = 'public' and tablename = 'hub_user_roles')),
  (17, 'sofia_has_access não foi tocada (não cita sofia_pode_gerir)', 'true',
      (select (position('sofia_pode_gerir' in prosrc) = 0)::text
       from pg_proc where oid = to_regprocedure('public.sofia_has_access()')))
) as t(n, verificacao, esperado, encontrado)
order by n;


-- ============================================================
-- ROLLBACK (comentado). Ordem importa: restaurar os 3 corpos ANTES de dropar
-- sofia_pode_gerir — plpgsql não registra dependência, então o drop passaria
-- e os triggers quebrariam no primeiro uso. Antes, anote quem era gestor:
--   select * from public.sofia_gestores;
-- Reverter o app (deploy anterior) ANTES deste rollback: o app novo chama
-- sofia_pode_gerir por RPC e, sem ela, nega tudo até para admin.
-- NÃO reaplicar sdd-sql-v04-seguranca.sql inteiro para "voltar": ele recria
-- as 18 policies sem o (select ...) do perf-rls-initplan.
-- ============================================================
-- begin;
--
-- create or replace function public.sofia_bloquear_autorizacao_nao_admin()
-- returns trigger language plpgsql security definer
-- set search_path = pg_catalog, public
-- as $$
-- begin
--   if not public.sofia_is_admin() then
--     if TG_OP = 'UPDATE' then
--       if TG_TABLE_NAME = 'multas' then
--         if new.autorizacao_status is distinct from old.autorizacao_status
--           or new.valor_descontado is distinct from old.valor_descontado
--           or new.status is distinct from old.status
--         then
--           raise exception 'Apenas administradores podem alterar autorização/desconto de multas';
--         end if;
--       elsif TG_TABLE_NAME = 'sinistros' then
--         if new.autorizacao_status is distinct from old.autorizacao_status
--           or new.valor_descontado is distinct from old.valor_descontado
--           or new.status_desconto is distinct from old.status_desconto
--         then
--           raise exception 'Apenas administradores podem alterar autorização/desconto de sinistros';
--         end if;
--       elsif TG_TABLE_NAME = 'km_excedido_desconto' then
--         if new.autorizacao_status is distinct from old.autorizacao_status then
--           raise exception 'Apenas administradores podem alterar autorização de KM excedido';
--         end if;
--       end if;
--     elsif TG_OP = 'INSERT' then
--       if TG_TABLE_NAME = 'multas' then
--         if new.autorizacao_status is distinct from 'sem_solicitacao'
--           or new.valor_descontado is not null
--           or new.status is distinct from 'pendente'
--         then
--           raise exception 'Apenas administradores podem inserir multas com autorização/desconto já definidos';
--         end if;
--       elsif TG_TABLE_NAME = 'sinistros' then
--         if new.autorizacao_status is distinct from 'sem_solicitacao'
--           or new.valor_descontado is not null
--           or new.status_desconto is distinct from 'pendente'
--         then
--           raise exception 'Apenas administradores podem inserir sinistros com autorização/desconto já definidos';
--         end if;
--       elsif TG_TABLE_NAME = 'km_excedido_desconto' then
--         if new.autorizacao_status is distinct from 'sem_solicitacao' then
--           raise exception 'Apenas administradores podem inserir KM excedido com autorização já definida';
--         end if;
--       end if;
--     elsif TG_OP = 'DELETE' then
--       if TG_TABLE_NAME in ('multas', 'sinistros', 'km_excedido_desconto') then
--         raise exception 'Apenas administradores podem excluir este registro';
--       end if;
--     end if;
--   end if;
--   if TG_OP = 'DELETE' then
--     return old;
--   end if;
--   return new;
-- end;
-- $$;
--
-- create or replace function public.sofia_bloquear_escrita_nao_admin()
-- returns trigger language plpgsql security definer
-- set search_path = pg_catalog, public
-- as $$
-- begin
--   if not public.sofia_is_admin() then
--     if TG_OP = 'UPDATE' then
--       if TG_TABLE_NAME = 'equipes' then
--         if new.ativo is distinct from old.ativo then
--           raise exception 'Apenas administradores podem ativar/desativar equipes';
--         end if;
--       elsif TG_TABLE_NAME = 'veiculos' then
--         if new.valor_locacao_mensal is distinct from old.valor_locacao_mensal then
--           raise exception 'Apenas administradores podem alterar o valor de locação do veículo';
--         end if;
--       end if;
--     elsif TG_OP = 'INSERT' then
--       if TG_TABLE_NAME = 'centro_custo_historico' then
--         raise exception 'Apenas administradores podem atualizar o centro de custo';
--       end if;
--     elsif TG_OP = 'DELETE' then
--       if TG_TABLE_NAME = 'abastecimentos' then
--         raise exception 'Apenas administradores podem excluir abastecimentos';
--       end if;
--       if TG_TABLE_NAME = 'km_diario' then
--         raise exception 'Apenas administradores podem excluir lançamentos de KM';
--       end if;
--     end if;
--   end if;
--   if TG_OP = 'DELETE' then
--     return old;
--   end if;
--   return new;
-- end;
-- $$;
--
-- create or replace function public.excluir_multas_em_massa(p_ids uuid[])
-- returns setof public.multas language plpgsql security definer
-- set search_path = pg_catalog, public
-- as $$
-- declare
--   v_multa record;
-- begin
--   if public.sofia_is_admin() is not true then
--     raise exception 'Apenas administradores podem excluir multas';
--   end if;
--   for v_multa in
--     delete from public.multas where id = any(p_ids) returning *
--   loop
--     insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id)
--     values (
--       'multas', 'excluiu', v_multa.id::text,
--       'Multa excluída em massa — ' || coalesce(v_multa.tipo_infracao, v_multa.descricao, v_multa.id::text),
--       auth.uid()
--     );
--     return next v_multa;
--   end loop;
-- end;
-- $$;
-- revoke execute on function public.excluir_multas_em_massa(uuid[]) from public, anon;
-- grant execute on function public.excluir_multas_em_massa(uuid[]) to authenticated;
--
-- drop function if exists public.sofia_pode_gerir();
-- drop table if exists public.sofia_gestores;
--
-- commit;
```

### 4.2 `sdd-sql-sofia-gestor-frotas-teste.sql` (texto completo)

Identidades: **G** gestor (linha em `sofia_gestores` + slug `sofia` + `analista`), **U** comum (slug `sofia` +
`analista`), **A** administrador, **N** sem linha em lugar nenhum, **X** gestor cujo slug `sofia` foi desligado
(`has_access = false`), e JWT sem e-mail. Fixtures `__teste_gf_*` só existem dentro da transação.

```sql
-- ============================================================
-- Sofia — gestor de frotas: TESTE DE COMPORTAMENTO (não altera nada)
-- Rodar DEPOIS de sdd-sql-sofia-gestor-frotas.sql, como postgres (SQL
-- Editor ou Management API com o PAT), projeto iyytcavcgukfjnjjrerx.
-- O bloco TERMINA EM ERRO DE PROPÓSITO: o raise final é o relatório e a
-- garantia de rollback. Resultado esperado: "RESUMO: N/N OK".
-- Se uma fixture falhar por coluna NOT NULL que não está nos arquivos,
-- é deriva de schema: ajustar a fixture, nunca o teste.
-- ============================================================

begin;

do $$
declare
  uid_g constant uuid := '00000000-0000-4000-a000-0000000000a1';
  uid_u constant uuid := '00000000-0000-4000-a000-0000000000a2';
  uid_a constant uuid := '00000000-0000-4000-a000-0000000000a3';
  uid_n constant uuid := '00000000-0000-4000-a000-0000000000a4';
  uid_x constant uuid := '00000000-0000-4000-a000-0000000000a5';
  mail_g constant text := '__teste_gf_gestor@manfac.com.br';
  mail_u constant text := '__teste_gf_comum@manfac.com.br';
  mail_a constant text := '__teste_gf_admin@manfac.com.br';
  mail_n constant text := '__teste_gf_semlinha@manfac.com.br';
  mail_x constant text := '__teste_gf_gestor_sem_slug@manfac.com.br';
  e1  uuid := gen_random_uuid();
  v1  uuid := gen_random_uuid();
  m1  uuid := gen_random_uuid();  -- G altera autorização/desconto
  m2  uuid := gen_random_uuid();  -- G apaga direto
  m3  uuid := gen_random_uuid();  -- G apaga em massa
  m4  uuid := gen_random_uuid();  -- U/N/X tentam, sobrevive
  m5  uuid := gen_random_uuid();  -- A apaga direto
  m6  uuid := gen_random_uuid();  -- A apaga em massa
  s1  uuid := gen_random_uuid();  -- G altera desconto
  s2  uuid := gen_random_uuid();  -- G apaga
  s3  uuid := gen_random_uuid();  -- A altera desconto
  ke1 uuid := gen_random_uuid();  -- G autoriza
  ke2 uuid := gen_random_uuid();  -- G apaga
  k1  uuid := gen_random_uuid();  -- G apaga
  k2  uuid := gen_random_uuid();  -- U tenta apagar
  a1  uuid := gen_random_uuid();  -- G apaga
  a2  uuid := gen_random_uuid();  -- U tenta apagar
  r   text[] := '{}';
  n_ok int := 0;
  n_total int := 0;
  v_int int;
  v_int2 int;
  v_txt text;
begin
  -- ---------- FIXTURES (postgres, acima da RLS) ----------
  insert into auth.users (id, email, aud, role) values
    (uid_g, mail_g, 'authenticated', 'authenticated'),
    (uid_u, mail_u, 'authenticated', 'authenticated'),
    (uid_a, mail_a, 'authenticated', 'authenticated'),
    (uid_n, mail_n, 'authenticated', 'authenticated'),
    (uid_x, mail_x, 'authenticated', 'authenticated');

  insert into public.hub_user_roles (user_email, nivel, granted_by) values
    (mail_g, 'analista', 'teste-gf'),
    (mail_u, 'analista', 'teste-gf'),
    (mail_a, 'administrador', 'teste-gf'),
    (mail_x, 'analista', 'teste-gf');

  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by) values
    (mail_g, 'sofia', true,  'teste-gf'),
    (mail_u, 'sofia', true,  'teste-gf'),
    (mail_x, 'sofia', false, 'teste-gf');

  insert into public.sofia_gestores (user_email, granted_by) values
    (mail_g, 'teste-gf'),
    (mail_x, 'teste-gf');

  insert into public.equipes (id, codigo, ativo) values (e1, '__teste_gf_e1', true);
  insert into public.veiculos (id, placa, modelo, km_atual, valor_locacao_mensal, equipe_id)
  values (v1, '__TGF01', 'teste', 1000, 1000, e1);

  insert into public.multas (id, veiculo_id, data, descricao, valor) values
    (m1, v1, current_date, 'teste-gf', 10), (m2, v1, current_date, 'teste-gf', 10),
    (m3, v1, current_date, 'teste-gf', 10), (m4, v1, current_date, 'teste-gf', 10),
    (m5, v1, current_date, 'teste-gf', 10), (m6, v1, current_date, 'teste-gf', 10);
  insert into public.sinistros (id, veiculo_id, data, descricao) values
    (s1, v1, current_date, 'teste-gf'), (s2, v1, current_date, 'teste-gf'),
    (s3, v1, current_date, 'teste-gf');
  insert into public.km_excedido_desconto (id, veiculo_id, mes, km_contratual, km_realizado) values
    (ke1, v1, date '2000-01-01', 100, 200), (ke2, v1, date '2000-02-01', 100, 200);
  insert into public.km_diario (id, equipe_id, veiculo_id, km_atual, data) values
    (k1, e1, v1, 900, date '2000-01-01'), (k2, e1, v1, 950, date '2000-01-02');
  insert into public.abastecimentos (id, veiculo_id, data, valor) values
    (a1, v1, current_date, 50), (a2, v1, current_date, 50);

  -- ---------- (p1) POSTGRES SEM JWT continua barrado (limitação mantida) ----------
  n_total := n_total + 1;
  begin
    update public.multas set autorizacao_status = 'solicitado' where id = m4;
    r := r || '(p1) postgres sem JWT alterando autorização: *** FALHOU *** (passou)'::text;
  exception when raise_exception then
    n_ok := n_ok + 1; r := r || '(p1) postgres sem JWT alterando autorização: OK (barrado)'::text;
  end;

  -- ================= GESTOR (G) =================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'email', mail_g, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if public.sofia_pode_gerir() is true then n_ok := n_ok + 1; r := r || '(g1) G: sofia_pode_gerir = true: OK'::text;
  else r := r || '(g1) G: sofia_pode_gerir = true: *** FALHOU ***'::text; end if;

  -- (g2) multa: autorização + valor descontado
  n_total := n_total + 1;
  begin
    update public.multas set autorizacao_status = 'solicitado', valor_descontado = 10 where id = m1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g2) G altera autorização/desconto de multa: OK'::text;
    else r := r || format('(g2) G altera autorização/desconto de multa: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g2) G altera autorização/desconto de multa: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g3) sinistro: desconto
  n_total := n_total + 1;
  begin
    update public.sinistros set autorizacao_status = 'solicitado', valor_descontado = 5 where id = s1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g3) G altera desconto de sinistro: OK'::text;
    else r := r || format('(g3) G altera desconto de sinistro: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g3) G altera desconto de sinistro: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g4) KM excedido: autorizar
  n_total := n_total + 1;
  begin
    update public.km_excedido_desconto set autorizacao_status = 'autorizado' where id = ke1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g4) G autoriza KM excedido: OK'::text;
    else r := r || format('(g4) G autoriza KM excedido: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g4) G autoriza KM excedido: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g5) desativar equipe
  n_total := n_total + 1;
  begin
    update public.equipes set ativo = false where id = e1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g5) G desativa equipe: OK'::text;
    else r := r || format('(g5) G desativa equipe: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g5) G desativa equipe: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g6) valor de locação
  n_total := n_total + 1;
  begin
    update public.veiculos set valor_locacao_mensal = 1500 where id = v1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g6) G altera valor de locação: OK'::text;
    else r := r || format('(g6) G altera valor de locação: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g6) G altera valor de locação: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g7) centro de custo
  n_total := n_total + 1;
  begin
    insert into public.centro_custo_historico (veiculo_id, centro_custo, vigente_desde)
    values (v1, '__teste_gf_cc', current_date);
    n_ok := n_ok + 1; r := r || '(g7) G registra centro de custo: OK'::text;
  exception when others then r := r || ('(g7) G registra centro de custo: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g8) apagar abastecimento e KM
  n_total := n_total + 1;
  begin
    delete from public.abastecimentos where id = a1;
    get diagnostics v_int = row_count;
    delete from public.km_diario where id = k1;
    get diagnostics v_int2 = row_count;
    if v_int = 1 and v_int2 = 1 then n_ok := n_ok + 1; r := r || '(g8) G apaga abastecimento e KM: OK'::text;
    else r := r || '(g8) G apaga abastecimento e KM: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g8) G apaga abastecimento e KM: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g9) apagar multa, sinistro e KM excedido direto (ramo DELETE do trigger)
  n_total := n_total + 1;
  begin
    delete from public.multas where id = m2;
    delete from public.sinistros where id = s2;
    delete from public.km_excedido_desconto where id = ke2;
    select count(*) into v_int from (
      select id from public.multas where id = m2
      union all select id from public.sinistros where id = s2
      union all select id from public.km_excedido_desconto where id = ke2) x;
    if v_int = 0 then n_ok := n_ok + 1; r := r || '(g9) G apaga multa/sinistro/KM excedido: OK'::text;
    else r := r || format('(g9) G apaga multa/sinistro/KM excedido: *** FALHOU *** (sobraram %s)', v_int); end if;
  exception when others then r := r || ('(g9) G apaga multa/sinistro/KM excedido: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g10) exclusão em massa grava audit_log com o autor do JWT
  n_total := n_total + 1;
  begin
    select count(*) into v_int from public.excluir_multas_em_massa(array[m3]);
    if v_int = 1 and exists (select 1 from public.audit_log
                             where registro_id = m3::text and usuario_id = uid_g) then
      n_ok := n_ok + 1; r := r || '(g10) G exclui multas em massa (com audit_log): OK'::text;
    else r := r || format('(g10) G exclui multas em massa: *** FALHOU *** (%s apagadas)', v_int); end if;
  exception when others then r := r || ('(g10) G exclui multas em massa: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- ----- G NÃO ganha nada fora do Sofia -----
  -- (g11) não se concede outro sistema
  n_total := n_total + 1;
  begin
    insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
    values (mail_g, 'obras', true, 'invasor');
    r := r || '(g11) G se concedendo slug obras: *** FALHOU *** (insert passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g11) G se concedendo slug obras: OK (barrado)'::text;
  end;

  -- (g12) não religa acesso de ninguém (UPDATE sem policy = 0 linhas, sem erro)
  -- Sem policy de UPDATE a RLS filtra para 0 linhas SEM erro; se o grant de
  -- UPDATE não existir, vem insufficient_privilege. Os dois são aprovação.
  n_total := n_total + 1;
  begin
    update public.hub_system_access set has_access = true where user_email = mail_x;
    get diagnostics v_int = row_count;
    if v_int = 0 then n_ok := n_ok + 1; r := r || '(g12) G alterando hub_system_access: OK (0 linhas)'::text;
    else r := r || format('(g12) G alterando hub_system_access: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g12) G alterando hub_system_access: OK (sem privilégio)'::text;
  end;

  -- (g13) não se promove a administrador
  n_total := n_total + 1;
  v_int := 0;
  begin
    update public.hub_user_roles set nivel = 'administrador' where user_email = mail_g;
    get diagnostics v_int = row_count;
  exception when insufficient_privilege then null;
  end;
  select nivel into v_txt from public.hub_user_roles where user_email = mail_g;
  if v_int = 0 and v_txt = 'analista' then n_ok := n_ok + 1; r := r || '(g13) G se promovendo: OK (continua analista)'::text;
  else r := r || format('(g13) G se promovendo: *** FALHOU *** (%s linhas, nivel %s)', v_int, v_txt); end if;

  -- (g14) não cria linha de nível para outro
  n_total := n_total + 1;
  begin
    insert into public.hub_user_roles (user_email, nivel, granted_by) values (mail_n, 'administrador', 'invasor');
    r := r || '(g14) G inserindo em hub_user_roles: *** FALHOU *** (insert passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g14) G inserindo em hub_user_roles: OK (barrado)'::text;
  end;

  -- (g15) não apaga acesso/nível de ninguém
  n_total := n_total + 1;
  v_int := 0; v_int2 := 0;
  begin
    delete from public.hub_system_access where user_email = mail_u;
    get diagnostics v_int = row_count;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.hub_user_roles where user_email = mail_u;
    get diagnostics v_int2 = row_count;
  exception when insufficient_privilege then null;
  end;
  if v_int = 0 and v_int2 = 0 then n_ok := n_ok + 1; r := r || '(g15) G apagando acesso de outro: OK (0 linhas)'::text;
  else r := r || format('(g15) G apagando acesso de outro: *** FALHOU *** (%s linhas)', v_int); end if;

  -- (g16) não nomeia outro gestor
  n_total := n_total + 1;
  begin
    insert into public.sofia_gestores (user_email, granted_by) values (mail_u, 'invasor');
    r := r || '(g16) G nomeando gestor: *** FALHOU *** (insert passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g16) G nomeando gestor: OK (barrado)'::text;
  end;

  -- (g17) não lê nem apaga sofia_gestores
  n_total := n_total + 1;
  begin
    delete from public.sofia_gestores where user_email = mail_x;
    r := r || '(g17) G apagando sofia_gestores: *** FALHOU *** (delete passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g17) G apagando sofia_gestores: OK (barrado)'::text;
  end;

  -- (g18) não é admin no hub nem em Obras, não abre Obras
  n_total := n_total + 1;
  if public.sofia_is_admin() is false
     and public.obras_is_admin() is false
     and public.hub_tem_acesso_sistema('obras') is false then
    n_ok := n_ok + 1; r := r || '(g18) G não é admin do hub/Obras nem abre Obras: OK'::text;
  else r := r || '(g18) G não é admin do hub/Obras nem abre Obras: *** FALHOU ***'::text; end if;

  -- ================= COMUM (U) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_u, 'email', mail_u, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if public.sofia_pode_gerir() is false then n_ok := n_ok + 1; r := r || '(u1) U: sofia_pode_gerir = false: OK'::text;
  else r := r || '(u1) U: sofia_pode_gerir = false: *** FALHOU ***'::text; end if;

  n_total := n_total + 1;
  begin
    update public.multas set autorizacao_status = 'solicitado' where id = m4;
    r := r || '(u2) U alterando autorização de multa: *** FALHOU *** (passou)'::text;
  exception when raise_exception then
    if sqlerrm like '%gestores de frotas%' then n_ok := n_ok + 1; r := r || '(u2) U alterando autorização de multa: OK (barrado, mensagem nova)'::text;
    else r := r || ('(u2) U alterando autorização: *** FALHOU *** (mensagem antiga: ' || sqlerrm || ')')::text; end if;
  end;

  n_total := n_total + 1;
  begin
    delete from public.km_diario where id = k2;
    r := r || '(u3) U apagando KM: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u3) U apagando KM: OK (barrado)'::text;
  end;

  n_total := n_total + 1;
  begin
    delete from public.abastecimentos where id = a2;
    r := r || '(u4) U apagando abastecimento: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u4) U apagando abastecimento: OK (barrado)'::text;
  end;

  n_total := n_total + 1;
  begin
    perform public.excluir_multas_em_massa(array[m4]);
    r := r || '(u5) U excluindo multas em massa: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u5) U excluindo multas em massa: OK (barrado)'::text;
  end;

  n_total := n_total + 1;
  begin
    update public.veiculos set valor_locacao_mensal = 1 where id = v1;
    r := r || '(u6) U alterando locação: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u6) U alterando locação: OK (barrado)'::text;
  end;

  -- (u7) regressão da armadilha 42703: UPDATE comum em veículo e equipe continua passando
  n_total := n_total + 1;
  begin
    update public.veiculos set modelo = 'teste2' where id = v1;
    update public.equipes set centro_custo = '__teste_gf' where id = e1;
    n_ok := n_ok + 1; r := r || '(u7) U editando campo livre de veículo/equipe: OK'::text;
  exception when others then r := r || ('(u7) U editando campo livre: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  n_total := n_total + 1;
  begin
    insert into public.centro_custo_historico (veiculo_id, centro_custo, vigente_desde) values (v1, 'x', current_date);
    r := r || '(u8) U registrando centro de custo: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u8) U registrando centro de custo: OK (barrado)'::text;
  end;

  -- ================= SEM LINHA (N) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_n, 'email', mail_n, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if coalesce(public.sofia_pode_gerir()::text, 'NULL') = 'false' then
    n_ok := n_ok + 1; r := r || '(n1) N sem linha: sofia_pode_gerir = false (não NULL): OK'::text;
  else r := r || '(n1) N sem linha: *** FALHOU ***'::text; end if;

  -- RPC security definer ignora RLS: a guarda é a única barreira
  n_total := n_total + 1;
  begin
    perform public.excluir_multas_em_massa(array[m4]);
    r := r || '(n2) N excluindo multas em massa: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(n2) N excluindo multas em massa: OK (barrado)'::text;
  end;

  -- ================= GESTOR SEM SLUG (X) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_x, 'email', mail_x, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if public.sofia_pode_gerir() is false then n_ok := n_ok + 1; r := r || '(x1) X (gestor com slug desligado): false: OK'::text;
  else r := r || '(x1) X (gestor com slug desligado): *** FALHOU ***'::text; end if;

  n_total := n_total + 1;
  begin
    perform public.excluir_multas_em_massa(array[m4]);
    r := r || '(x2) X excluindo multas em massa: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(x2) X excluindo multas em massa: OK (barrado)'::text;
  end;

  -- ================= JWT SEM E-MAIL =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  if coalesce(public.sofia_pode_gerir()::text, 'NULL') = 'false' then
    n_ok := n_ok + 1; r := r || '(j1) JWT sem e-mail: false (não NULL): OK'::text;
  else r := r || '(j1) JWT sem e-mail: *** FALHOU ***'::text; end if;

  -- ================= ADMIN (A) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_a, 'email', mail_a, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if public.sofia_pode_gerir() is true then n_ok := n_ok + 1; r := r || '(a1) A: sofia_pode_gerir = true: OK'::text;
  else r := r || '(a1) A: *** FALHOU ***'::text; end if;

  n_total := n_total + 1;
  begin
    update public.sinistros set autorizacao_status = 'autorizado', valor_descontado = 5 where id = s3;
    delete from public.multas where id = m5;
    select count(*) into v_int from public.excluir_multas_em_massa(array[m6]);
    if v_int = 1 and not exists (select 1 from public.multas where id in (m5, m6)) then
      n_ok := n_ok + 1; r := r || '(a2) A altera desconto, apaga multa e exclui em massa: OK'::text;
    else r := r || '(a2) A: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(a2) A: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (z) m4 sobreviveu a todas as tentativas de U/N/X
  n_total := n_total + 1;
  if exists (select 1 from public.multas where id = m4 and autorizacao_status = 'sem_solicitacao') then
    n_ok := n_ok + 1; r := r || '(z) multa m4 intacta depois de U/N/X: OK'::text;
  else r := r || '(z) multa m4 intacta: *** FALHOU ***'::text; end if;

  raise exception E'TESTE gestor de frotas (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;
```

Resultado esperado: **35/35 OK** (p1, g1–g18, u1–u8, n1–n2, x1–x2, j1, a1–a2, z). Confirmar depois, como postgres,
que nada ficou: `select count(*) from public.sofia_gestores where user_email like '__teste_gf_%'` = 0 e o mesmo em
`hub_user_roles`/`hub_system_access`/`auth.users`.

---

## 5. Plano de tarefas (ordem; cada uma pequena)

Pré-condição: branch paralelo de mensagens mergeado (§3.4). Branch novo a partir do `master` atualizado.

| # | Tarefa | Arquivos | Testes (jest) / prova |
|---|---|---|---|
| T1 | Escrever `sdd-sql-sofia-gestor-frotas.sql` e `sdd-sql-sofia-gestor-frotas-teste.sql` a partir de §4, copiando o texto literal. **Não aplicar.** | raiz | revisão independente do SQL (outro agente) |
| T2 | Helper `lib/sofia/permissoes.ts` (§3.1) | novo | `lib/sofia/__tests__/permissoes.test.ts`: `podeGerirFrotas` → `true` só com `{data: true, error: null}`; `false` com `data: false`, `data: null`, `data: 'true'` (string), `data: 1`, e com `error` preenchido mesmo que `data: true`; chama `rpc('sofia_pode_gerir')` **sem argumentos** (identidade vem do JWT). `requireGestorFrotas` → mensagem sem chamar `rpc` quando não há usuário; `null` quando rpc `true`; mensagem quando rpc `false` ou erro |
| T3 | Trocar as 27 checagens (§3.2) + mensagens do branch paralelo (§3.4) | 11 `_actions.ts` | Nos 8 testes existentes que fazem `jest.mock('@/lib/auth/roles')` (`abastecimento`, `custos`, `descontos`, `equipes`, `km`, `multas`, `sinistros`, `veiculos` em `__tests__/_actions.test.ts`): remover o mock de `roles`, adicionar `rpc` ao client mockado e rotear por nome (`fn === 'sofia_pode_gerir' ? {data: <bool>, error: null} : <rpc atual>` — `multas` já usa `rpc` para `excluir_multas_em_massa`, `km` para `lancar_km_atomico`). Para **cada** action da tabela: (a) gestor (rpc `true`) executa a escrita; (b) comum (rpc `false`) recebe a mensagem nova e **nenhum** `from(...).update/insert/delete`/`rpc` de escrita é chamado; (c) rpc com `error` = negado. Atualizar as 12 asserções que hoje esperam "Apenas administradores…". Novos testes para `checklist`, `motoristas`, `revisoes` (hoje sem teste de `_actions`, `.claude/rules/sofia.md`) cobrindo só a action de exclusão/desativação |
| T4 | Tela Multas (§3.3) | `multas/page.tsx`, `multas/_table.tsx` | teste de render do `_table` (se já houver padrão de teste de componente; senão, cobertura pela troca de prop e `npm run build`) |
| T5 | Trava contra regressão | `lib/sofia/__tests__/sem-admin-do-hub.test.ts` (novo) | lê todo `app/(operacoes)/sofia/**/_actions.ts` e `**/page.tsx` com `fs` e falha se algum importar `@/lib/auth/requireAdmin` ou `isAdmin` de `@/lib/auth/roles`. Garante que action nova do Sofia não volte a exigir admin do hub |
| T6 | Limpeza de usuário (§3.5) | `app/admin/_actions.ts:136-150` | `app/admin/__tests__/_actions.test.ts:339` e `:490`: `tabelasApagadas` passa a ser `['hub_user_roles', 'hub_system_access', 'sofia_gestores']`; novo caso: erro ao apagar `sofia_gestores` devolve a mensagem de "sobraram registros" |
| T7 | `npm test` (o número que importa exclui as 7 suites de `manfac-site/`), `npm run lint`, `npm run build` | — | tudo verde |
| T8 | Docs no mesmo commit da implementação (regra zero) | `.claude/rules/sofia.md` (seção "Autorização e os triggers": `sofia_pode_gerir`, `sofia_gestores`, mensagens novas), `.claude/rules/acesso-e-admin.md` (terceira tabela de autorização, só do Sofia; nunca policy de escrita), `.claude/rules/sql.md` (linha `sofia-gestor-frotas` NÃO APLICADO na tabela de estado; nota de que a limitação do SQL Editor agora diz "…ou gestores de frotas"), `docs/DIVIDAS.md` (tela de concessão em `/admin/acessos` adiada; `softDeleteVeiculoAction` sem trava) | — |
| T9 | Code review independente (agente diferente do implementador), com foco em: 27 trocas sem sobra (`grep`), corpos SQL idênticos aos originais exceto guarda/mensagem (diff linha a linha contra `sdd-sql-v04-seguranca.sql:165-299` e `track-c:186-231`), nenhuma policy/grant de escrita | — | — |
| T10 | **Com autorização do João:** leitura em produção antes de aplicar — `select pg_get_functiondef(...)` das 3 funções e diff contra os arquivos; `select * from pg_trigger where tgname like 'trg_bloquear_%'`; `select to_regclass('public.sofia_gestores')` (tem que ser NULL) | — | registro em `docs/frotas/` |
| T11 | **Com autorização do João:** aplicar a migration (17/17 OK), rodar o teste (35/35 OK), conferir 0 linhas `__teste_gf_%` | produção | colar o resultado na linha da tabela de `sql.md` |
| T12 | Deploy do app (João clica Deploy; conferir `Last-Modified` dos chunks) | — | fumaça como admin: excluir/autorizar no Sofia continua funcionando |
| T13 | Conceder o Igor (§1.4): confirmar o e-mail exato em `auth.users` e a linha `sofia`/`has_access = true`; inserir em `sofia_gestores` | produção | fumaça com o Igor (ou o João acompanhando): trocar equipe do veículo, alterar locação, autorizar desconto, excluir KM; e conferir que `/admin/acessos` continua redirecionando ele para `/dashboard` |

T2, T4, T5 e T6 não se sobrepõem em arquivo e podem ir em paralelo; T3 depende de T2.

---

## 6. Riscos e o que não deu para verificar

**Não verificado (sem acesso ao banco nesta tarefa):**
- **Se os corpos de `sofia_bloquear_autorizacao_nao_admin`, `sofia_bloquear_escrita_nao_admin` e
  `excluir_multas_em_massa` em produção são idênticos aos arquivos.** `sdd-sql-v04-seguranca.sql:11-15` e
  `track-c:13-24` dizem "aplicado em 10/08/2026", e o arquivo v04 registra uma correção feita **durante** a
  aplicação (`:173-180`). Mitigação: seção 0 da migration (contagem de `raise`, colunas-chave, 8 triggers habilitados)
  e a T10 (diff completo de `pg_get_functiondef` antes de aplicar). Se divergir, parar e reescrever a migration a
  partir do corpo de produção.
- **Se existe algum outro trigger/policy/função em produção que cheque `sofia_is_admin()`** e não esteja nos arquivos.
  T10 deve incluir: `select proname from pg_proc where prosrc like '%sofia_is_admin%'` — esperado só
  `sofia_has_access` e as três desta spec (antes de aplicar).
- **E-mail do Igor e se ele tem o slug `sofia`** — não está em nenhum doc do repo. Confirmar em `auth.users`/
  `hub_system_access` na T13; se houver mais de um candidato, perguntar ao João.
- **Colunas NOT NULL extras** nas tabelas do Sofia em produção (o teste usa as colunas mínimas dos arquivos). Se uma
  fixture falhar, é deriva de schema a registrar, não motivo para afrouxar o teste.
- **Valores aceitos por CHECK** em `multas.status`/`sinistros.status_desconto`: o teste evita alterá-los (usa só
  `autorizacao_status`, cujo CHECK está em `sdd-sql-autorizacao.sql`, e `valor_descontado`).
- O comportamento exato de `set_config('role', 'authenticated', true)` dentro de `do $$` foi comprovado pelo teste de
  `hub_comunicados` (13/13 em 22/09/2026); o deste arquivo nunca rodou. **SQL só é verificado rodando.**

**Riscos do desenho:**
- **Deploy do app antes do SQL** → admin perde as ações do Sofia (falha fechado). Mitigado pela ordem da §4 e pela
  T12 depois da T11.
- **Linha órfã em `sofia_gestores`** após remover usuário → mitigado pela T6. Se alguém apagar usuário pelo painel do
  Supabase (fora da tela), a linha fica; continua inerte enquanto não houver slug `sofia` para aquele e-mail.
- **Gestor vê o que o admin vê no Sofia, inclusive desconto em salário** — é a decisão D2, não risco; registrado para
  que o revisor não "corrija".
- **Mensagens do banco mudam** ("Apenas administradores ou gestores de frotas…"). Nenhuma action repassa essas
  mensagens ao usuário (só `SOF01`), mas quem usa o contorno do SQL Editor verá o texto novo — atualizar
  `sofia.md`/`sql.md` (T8).
- **`softDeleteVeiculoAction` segue sem trava** (qualquer um com o slug desativa veículo) — fora do escopo;
  registrar em `DIVIDAS.md`.
- **Corrigir KM/abastecimento (itens 7 e 9)** não existe; quando F2/F3 forem feitas, a função de correção de KM no
  banco precisa da guarda `sofia_pode_gerir() is not true` (se ficar restrita) ou `sofia_has_access() is not true`
  (se liberada a todos) — decisão daquela spec.
