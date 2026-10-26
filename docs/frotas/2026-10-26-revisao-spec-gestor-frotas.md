# Revisão adversarial da spec do gestor de frotas — 26/10/2026

Revisor independente (não escreveu a spec). Veredito: **aprovada com uma correção obrigatória**. Sem escalada, sem
falha aberta, sem defeito de migration.

## Correção obrigatória (o implementador aplica; prevalece sobre §3.3 e §3.4 da spec)

### 3.3 Telas (substitui o §3.3 da spec)
Cinco telas do Sofia escondem ações de quem não pode (Multas desde antes; as outras quatro pelo commit `e8d1887`,
merge `11d5f02`). Em todas, `import { isAdmin } from '@/lib/auth/roles'` vira
`import { podeGerirFrotas } from '@/lib/sofia/permissoes'`, e
`const admin = await isAdmin(supabase, userData.user?.email ?? '')` vira `const podeGerir = await podeGerirFrotas(supabase)`.
O `getUser()` sai quando não sobrar outro uso.
- `multas/page.tsx:3,19,47`: `isAdmin={admin}` vira `podeGerir={podeGerir}`. Em `multas/_table.tsx`, a prop `isAdmin`
  vira `podeGerir` (`:23,:26`) e todos os usos (`:75,:85,:104,:130,:158,:167`) passam a ler `podeGerir`.
- `equipes/page.tsx:5,39`: botão "Ativar" com `!equipe.ativo && podeGerir`.
- `km/page.tsx:3,13`: `showActions={excedido && podeGerir}`.
- `sinistros/page.tsx:5,38`: `showActions={podeGerir}`.
- `descontos/page.tsx:15,48`: `showActions={podeGerir}` e os três botões (avançar status, desfazer desconto,
  registrar desconto) passam a usar `podeGerir &&`.

Nenhuma outra tela do Sofia lê nível (grep em 26/10 sobre `app/(operacoes)/sofia`, `lib/sofia`, `components/sofia`).

### 3.4 Estado depois do merge `11d5f02` (substitui o §3.4 da spec)
O branch paralelo já está em `master`. Ele não criou mensagens novas: `toggleEquipeAction`,
`upsertKmExcedidoStatusAction`, `atualizarAutorizacaoKmExcedidoAction`, `atualizarAutorizacaoMultaAction` e
`atualizarAutorizacaoSinistroAction` continuam `Promise<void>` com retorno silencioso. Nelas, a troca é só
`const erroGestor = await requireGestorFrotas(supabase); if (erroGestor) return`, sem mudar a assinatura. "Constante" na
tabela §3.2 vale só para as actions que hoje devolvem ou lançam a mensagem. Antes de começar, rode de novo o grep do
passo 1; toda ocorrência fora de `__tests__` entra em §3.2 ou §3.3.

Base: trocar `aa375f4` por o HEAD do dia. As 27 linhas da §3.2 continuam valendo.

## Backlog do revisor — o coordenador decidiu INCLUIR na implementação
- Verificação #18: `has_table_privilege('service_role','public.sofia_gestores','SELECT,INSERT,DELETE')` = true.
- T5: varrer todo `.ts`/`.tsx` de `app/(operacoes)/sofia/**` e `components/sofia/**`, não só `_actions.ts`/`page.tsx`.
- Teste SQL, dois casos novos: gestor com linha em `sofia_gestores` e nenhuma linha em `hub_system_access`; gestor
  com e-mail no JWT em maiúscula/com espaço (prova o `lower(trim)`).
- Verificação #14: trocar `like 'trg_bloquear_%'` pela lista exata de nomes, como a seção 0.
- Seção 0: abortar antes do commit se `sofia_gestores` já existir com colunas ou PK diferentes.
- Fumaça T12 como admin: conferir que os botões aparecem nas 5 telas.

## Backlog do revisor — vai para `docs/DIVIDAS.md`
- Reconvite após remoção só provado no jest mockado (T6), não no banco.
- Vetor `auth.updateUser({email})` para o e-mail de um gestor órfão (risco já existia com `hub_user_roles`).
