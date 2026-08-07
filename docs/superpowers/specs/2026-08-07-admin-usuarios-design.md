# Módulo Admin — gestão de contas e acessos

**Data:** 2026-08-07
**Status:** aprovado (mockup aprovado por João em 2026-08-07)
**Mockup:** https://claude.ai/code/artifact/b3f7e5aa-f259-4c14-ae2f-f75dfa93862b

## Problema

O módulo Admin de hoje resolve uma coisa só: ligar e desligar o acesso de um e-mail a um
sistema. Tudo o mais que a administração do hub exige está fora dele.

1. **Quem é administrador está fixo no código.** `lib/auth/admins.ts` é um array literal.
   Promover ou remover um administrador exige commit, build e deploy — João depende de um
   desenvolvedor para uma decisão que é dele.
2. **Não existe o conceito de nível.** Ou a pessoa está na lista de admins, ou não é nada.
   Não há como dizer "esta pessoa opera os sistemas mas não mexe em usuários".
3. **Não dá para incluir ninguém.** Só existe auto-cadastro: a pessoa se cadastra sozinha e
   depois alguém libera o acesso na mão, em outra tela.
4. **Não dá para retirar ninguém.** Desligar os toggles remove o acesso aos sistemas, mas a
   conta continua existindo e conseguindo entrar no hub.
5. **A lista não escala.** Sem busca, sem filtro, sem ordenação, e `listUsers()` corta em 50
   usuários sem avisar ninguém — quem estiver na posição 51 simplesmente não aparece.
6. **A listagem não mostra nada útil.** Só o e-mail. Não mostra o nome (que o cadastro já
   coleta), nem quando a pessoa entrou pela última vez.
7. **O hub mostra portas fechadas.** `app/(dashboard)/dashboard/page.tsx` renderiza os cards
   de Gestão de Frotas e Conversor OS para todos. Quem não tem acesso clica, o middleware o
   devolve ao dashboard, e ninguém explica por quê.

O item 7 não é falha de segurança — o `middleware.ts` bloqueia o acesso de fato. É falha de
comunicação: a pessoa vê uma porta, empurra, e é devolvida em silêncio.

## Escopo

### Entra

- Nível de conta persistido no banco, com dois valores: `analista` e `administrador`.
- Tela de gestão de contas: listar, buscar, filtrar por nível, ordenar, paginar.
- Convidar uma pessoa por e-mail, já definindo nível e sistemas.
- Remover uma pessoa do hub (apaga a conta).
- Trocar o nível de uma pessoa.
- Enviar link de redefinição de senha.
- Reenviar e cancelar convite pendente.
- Controle de acesso por sistema, por usuário (evolução dos toggles atuais).
- Dashboard do hub montado a partir do acesso real de cada pessoa.

### Não entra

- **Funções customizáveis.** A referência visual tem um editor de funções. Os níveis aqui são
  dois e fixos; um editor resolveria um problema que não temos.
- **Um terceiro nível** (proprietário/gerente). Dois níveis, conforme decidido.
- **Suspender conta** mantendo-a no banco. Remover apaga. Se isso se mostrar necessário, vira
  spec própria.
- **Histórico de auditoria visível.** `hub_system_access.granted_by` continua sendo gravado,
  mas não ganha tela. Fora do escopo desta entrega.
- **Trocar o e-mail** de um usuário existente.

## Decisões de modelagem

### Nível vive no banco, não no JWT

Duas alternativas foram consideradas para guardar o nível:

**`app_metadata` do Supabase Auth** — viaja dentro do JWT, então a checagem continuaria
síncrona e sem custo de query. Rejeitada: o JWT fica válido até o refresh (~1h). Rebaixar ou
remover um administrador não teria efeito imediato — ele continuaria administrador até o token
expirar. Revogação precisa valer na hora.

**Tabela `hub_user_roles`** — escolhida. Uma query por verificação, revogação imediata, fonte
única de verdade, e o mesmo padrão que `hub_system_access` já usa. As rotas protegidas já
fazem uma query dessas por request (`hasSystemAccess` no middleware), então não é um custo novo.

### O nível não define o acesso aos sistemas

São dois eixos independentes, e a UI reflete isso em dois cards separados:

- **Nível** diz o que a pessoa pode *fazer*: analista opera; administrador também gerencia gente.
- **Acesso por sistema** diz *onde* ela entra.

Unificar os dois daria a analistas que hoje têm um único sistema liberado o acesso ao outro.
Isso seria uma concessão silenciosa de acesso na virada — inaceitável.

Exceção deliberada: **administrador acessa todos os sistemas**, sempre. É o comportamento atual
(`hasSystemAccess` retorna `true` para admin antes de consultar a tabela) e ele se mantém. Por
isso administradores aparecem no card Funções sem toggles, apenas com o rótulo de acesso total.

## Modelo de dados

Arquivo novo: `sdd-sql-admin-usuarios.sql`, rodado à mão no SQL Editor do Supabase, seguindo a
convenção do projeto.

```sql
CREATE TABLE IF NOT EXISTS hub_user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL UNIQUE,
  nivel text NOT NULL CHECK (nivel IN ('analista', 'administrador')),
  granted_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hub_user_roles ENABLE ROW LEVEL SECURITY;
```

`user_email` é sempre gravado normalizado (`trim().toLowerCase()`), como em `hub_system_access`.

### RLS — leitura para todos, escrita para ninguém

```sql
-- Qualquer autenticado LÊ (o middleware precisa disso a cada request).
CREATE POLICY "authenticated read" ON hub_user_roles
  FOR SELECT TO authenticated USING (true);

-- Ninguém escreve pelo client. Só a service role, que ignora RLS.
-- A ausência de policies de INSERT/UPDATE/DELETE é intencional.
```

Esta é a diferença deliberada em relação a `hub_system_access`, que hoje usa
`FOR ALL TO authenticated USING (true)` — uma política que permite a qualquer usuário logado
se auto-conceder acesso chamando o Supabase direto, contornando o `isAdminEmail` da Server
Action. Esse achado já estava documentado no code review do Conversor OS e não foi corrigido
por prazo.

Aqui ele **não se repete**: toda escrita em `hub_user_roles` passa obrigatoriamente pela
service role, dentro de Server Actions que verificam o nível de quem chamou. Um usuário que
tentar se promover pelo client é barrado pelo banco, não pela aplicação.

**Correção incluída nesta entrega:** `hub_system_access` recebe o mesmo tratamento. A política
`authenticated full access` é derrubada e substituída por leitura apenas, e
`alternarAcessoAction` passa a escrever com a service role. Sem isso, o novo módulo teria uma
tabela blindada ao lado de outra escancarada — um analista continuaria podendo se dar acesso a
qualquer sistema.

```sql
DROP POLICY IF EXISTS "authenticated full access" ON hub_system_access;

CREATE POLICY "authenticated read" ON hub_system_access
  FOR SELECT TO authenticated USING (true);
```

### Migração dos administradores atuais

O SQL faz o seed a partir da lista que existe hoje em `lib/auth/admins.ts`, para que ninguém
perca acesso na virada:

```sql
INSERT INTO hub_user_roles (user_email, nivel, granted_by) VALUES
  ('jose.guilherme@manfac.com.br', 'administrador', 'migracao'),
  ('jvictorco28@gmail.com',        'administrador', 'migracao')
ON CONFLICT (user_email) DO NOTHING;
```

Todo usuário existente que não esteja nessa lista recebe `analista`:

```sql
INSERT INTO hub_user_roles (user_email, nivel, granted_by)
SELECT lower(trim(email)), 'analista', 'migracao'
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_email) DO NOTHING;
```

A ordem importa: os administradores entram primeiro, e o `ON CONFLICT DO NOTHING` do segundo
comando impede que sejam rebaixados a analista.

> **Pendência de negócio, não de código:** `ewerton.silva@manfac.com.br` entra como
> administrador porque é o estado atual. João já sinalizou que talvez ele não deva ser. Depois
> desta entrega isso vira um clique na tela e não precisa mais de decisão prévia.

## Camada de autorização

### Arquivo novo: `lib/auth/roles.ts`

```ts
export type Nivel = 'analista' | 'administrador'

export async function getNivel(supabase, email: string): Promise<Nivel | null>
export async function isAdmin(supabase, email: string): Promise<boolean>
```

`getNivel` retorna `null` para quem não tem linha em `hub_user_roles` — o que significa "sem
nível atribuído", tratado como analista sem acesso a nada. `isAdmin` é açúcar sobre `getNivel`.

### `lib/auth/admins.ts` é deletado

A lista fixa deixa de existir. Não vira fallback: um fallback significaria que um administrador
removido pela tela continuaria administrador pelo código, que é exatamente o problema que esta
entrega resolve.

O arquivo de teste `lib/auth/__tests__/admins.test.ts` é removido junto, e seus casos úteis
(normalização de caixa e espaços) migram para os testes de `roles.ts`.

### Os 20 call sites

`isAdminEmail(email)` é chamado em 20 pontos de produção. Todos eles já estão dentro de funções
`async` e todos já têm um client Supabase em mãos, então a troca é mecânica:

```ts
// antes
if (!user?.email || !isAdminEmail(user.email)) return { error: '...' }
// depois
if (!user?.email || !(await isAdmin(supabase, user.email))) return { error: '...' }
```

Arquivos afetados:

| Arquivo | Ocorrências |
|---|---|
| `middleware.ts` | 1 |
| `lib/auth/requireAdmin.ts` | 1 |
| `lib/auth/systemAccess.ts` | 1 |
| `app/admin/_actions.ts` | 2 |
| `app/(dashboard)/dashboard/page.tsx` | 1 |
| `app/conversor-os/_actions.ts` | 1 |
| `app/conversor-os/historico/page.tsx` | 1 |
| `app/(operacoes)/sofia/veiculos/_actions.ts` | 4 |
| `app/(operacoes)/sofia/multas/_actions.ts` | 2 |
| `app/(operacoes)/sofia/multas/page.tsx` | 1 |
| `app/(operacoes)/sofia/motoristas/_actions.ts` | 1 |
| `app/(operacoes)/sofia/revisoes/_actions.ts` | 1 |
| `app/(operacoes)/sofia/sinistros/_actions.ts` | 1 |
| `app/(operacoes)/sofia/checklist/_actions.ts` | 1 |
| `app/(operacoes)/sofia/equipes/_actions.ts` | 1 |

`lib/auth/systemAccess.ts` mantém a assinatura e o comportamento: administrador continua
retornando `true` antes de consultar `hub_system_access`. Só troca a fonte do "é admin".

`middleware.ts` passa a fazer duas queries onde hoje faz uma. É aceitável: só ocorre em rotas
do `matcher`, e ambas são consultas indexadas por e-mail.

## Server Actions — `app/admin/_actions.ts`

Todas verificam `isAdmin` do chamador antes de qualquer efeito, e todas as escritas usam a
service role.

| Action | O que faz |
|---|---|
| `listarUsuariosAction(pagina, busca, filtroNivel)` | Lista usuários com nível, nome, último acesso e estado de convite |
| `convidarUsuarioAction(email, nivel, sistemas)` | Convida, cria o nível e concede os sistemas |
| `alterarNivelAction(email, nivel)` | Promove ou rebaixa |
| `removerUsuarioAction(email)` | Apaga a conta e suas linhas em `hub_user_roles` e `hub_system_access` |
| `reenviarConviteAction(email)` | Reenvia o convite |
| `cancelarConviteAction(email)` | Apaga a conta ainda não confirmada |
| `enviarResetSenhaAction(email)` | Dispara o e-mail de redefinição |
| `alternarAcessoAction(email, slug, valor)` | Já existe; passa a escrever com service role |

### Paginação e busca

`listUsers()` do Supabase aceita `page` e `perPage` e devolve 50 por padrão — daí o teto atual.
A Admin API não oferece busca por texto no servidor, o que deixa duas opções: paginar no
servidor sem busca global, ou carregar tudo e filtrar em memória.

Escolha: **paginar no servidor com `perPage: 100`, e a busca varre todas as páginas** —
o loop para assim que a API devolver uma página incompleta. Para a escala da Manfac (dezenas de
usuários) isso é uma ou duas chamadas, e o comportamento fica correto desde já.

### Fluxo de convite

`inviteUserByEmail` cria o usuário em estado não confirmado e envia o e-mail. O link expira em
24 horas — padrão do Supabase, e é o que o texto do card informa.

Um convidado é identificado por `confirmed_at == null`. Enquanto estiver nesse estado, a linha
mostra o chip "Convite pendente" no lugar da data de último acesso, e o menu oferece apenas
reenviar e cancelar.

**Atenção ao Auth Hook.** Existe um hook `before user created` no Supabase que rejeita e-mails
fora de `@manfac.com.br`. O convite passa por ele. Consequências:

- Convidar um e-mail fora do domínio falha no banco, não na aplicação. A action valida o
  domínio antes de chamar a API e devolve uma mensagem clara, em vez de deixar vazar o erro cru.
- A exceção do dono (`jvictorco28@gmail.com`) já está contemplada no hook e em
  `lib/auth/domain.ts`. Nada muda.

### Invariantes de segurança

Verificados **na Server Action**, não só na UI — a UI apenas reflete o que o servidor garante:

1. **Ninguém altera o próprio nível.** Um administrador não se rebaixa.
2. **Ninguém remove a si mesmo.**
3. **O último administrador não pode ser rebaixado nem removido.** A action conta os
   administradores restantes antes de aplicar. O hub nunca fica sem dono.
4. **Só administrador executa qualquer uma destas actions.**
5. **Remover é uma transação em três partes** — conta, nível e acessos. Se apagar a conta
   falhar, nada mais é apagado. As linhas órfãs de `hub_user_roles` e `hub_system_access` são
   inofensivas (não concedem acesso a uma conta que não existe), mas são limpas mesmo assim.

## Interface

Rota: `/admin/acessos` (mantida). Dois cards empilhados, tema do hub.

### Card "Conta"

Cabeçalho com o título, o aviso de expiração do convite em 24 horas, e o botão laranja
**Adicionar novo usuário**. Abaixo, busca e filtro por nível.

Tabela: **Nome** (nome em cima, e-mail embaixo) · **Nível** (pill, coluna ordenável) ·
**Ativo pela última vez** · menu `⋮`.

O nome vem de `user_metadata.full_name`, que o cadastro já coleta
(`app/(auth)/signup/actions.ts:35`). Quem não tiver nome mostra só o e-mail. Datas em
português, fuso `America/Sao_Paulo`, via `Intl.DateTimeFormat` — mesmo cuidado já aplicado nos
nomes de arquivo do Conversor OS.

O menu `⋮` oferece promover/rebaixar, enviar link de redefinir senha e remover. Nas linhas em
que um invariante proíbe a ação, o item aparece desabilitado com a explicação em texto — nunca
some sem justificativa.

### Card "Funções"

Uma linha por usuário, com um toggle por sistema. Administradores não têm toggles: mostram o
rótulo "Administrador acessa todos os sistemas", porque é o que de fato acontece.

Toggle verde quando ligado, navy `#0d2050` quando desligado — o padrão já estabelecido.

### Diálogos

**Adicionar novo usuário** — campo de e-mail, **dropdown de nível** (Analista / Administrador)
e toggles dos sistemas. Resolve tudo numa tela só.

**Remover** — explica que a conta será apagada e que o histórico registrado nos sistemas é
preservado. Exige digitar a palavra **`deletar`** para liberar o botão.

## Dashboard por nível

`app/(dashboard)/dashboard/page.tsx` passa a montar os cards a partir do acesso real:

```ts
const nivel = await getNivel(supabase, user.email)
const podeFrotas    = await hasSystemAccess(supabase, user.email, 'sofia')
const podeConversor = await hasSystemAccess(supabase, user.email, 'conversor-os')
const admin = nivel === 'administrador'
```

Cada card é renderizado apenas se a pessoa puder abri-lo. O card Admin, apenas para
administradores — comportamento que já existe hoje e se mantém.

Quem não tiver acesso a sistema nenhum vê uma mensagem explicando que ainda não há sistemas
liberados e que deve procurar um administrador. Melhor que uma grade vazia.

O `middleware.ts` continua sendo a fronteira real de autorização. Esta mudança é de
comunicação, não de segurança: o dashboard para de anunciar portas que a pessoa não pode abrir.

## Testes

Seguindo a convenção `__tests__/` ao lado do código.

**`lib/auth/__tests__/roles.test.ts`** — `getNivel` para administrador, analista e sem linha;
normalização de caixa e espaços no e-mail; `isAdmin` coerente com `getNivel`.

**`app/admin/__tests__/_actions.test.ts`** (estende o existente) — um caso por invariante:

- não-administrador é barrado em cada action
- administrador não altera o próprio nível
- administrador não remove a si mesmo
- o último administrador não é rebaixado nem removido
- convite para e-mail fora do domínio é recusado com mensagem clara
- a busca percorre todas as páginas, não só a primeira
- remoção limpa `hub_user_roles` e `hub_system_access`
- falha ao apagar a conta não apaga nível nem acessos

**`app/(dashboard)/dashboard/__tests__/page.test.tsx`** — administrador vê três cards; analista com
um sistema vê um; analista sem sistema nenhum vê a mensagem de orientação.

`lib/auth/__tests__/systemAccess.test.ts` é atualizado: mocka `roles` em vez de `admins`.

## Riscos

**A migração é o momento crítico.** Se o SQL não rodar antes do deploy do código, `getNivel`
devolve `null` para todo mundo e **ninguém é administrador** — inclusive João, que perderia a
tela para se reconceder acesso. A ordem é obrigatória: rodar o SQL no Supabase **primeiro**,
confirmar as linhas, e só então deployar. Isso entra no plano de implementação como etapa
própria, com verificação explícita.

**Uma query a mais no middleware.** Aceitável pela escala e pelo índice em `user_email`.

**Remoção é irreversível.** É o comportamento pedido. A confirmação por digitação e os
invariantes de servidor são a proteção.

## Fora desta spec, registrado

- **`/admin` retorna 404 em produção.** `app/admin/page.tsx` existe na máquina do João mas
  nunca foi commitado, então não está em `origin/master`. Bug independente, em investigação
  própria, com correção de um arquivo.
- **`hub_system_access` não tem histórico.** O upsert sobrescreve; `granted_by` guarda só o
  último. Uma tela de auditoria exigiria tabela de eventos — spec própria, se fizer falta.
