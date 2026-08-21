# Captura de leads no site + terreno do CRM no hub

**Data:** 2026-08-21
**Escopo:** frente B do `manfac-site` (`/contato` gravando lead) + módulo `/crm` no hub com a lista de leads em modo leitura
**Fora de escopo:** o CRM em si — infraestrutura própria, definida pelo João, executada em trabalho separado

## Por que isto existe

`ContactForm.tsx` é hoje 100% client-side: `preventDefault()` → monta a URL → `window.open()`.
Não há `fetch`, Server Action, rota de API nem persistência. **Nenhum lead é capturado.**
Quem não conclui no WhatsApp — popup bloqueado, app não instalado, desistência no meio —
não deixa rastro nenhum. O site gera demanda que ninguém consegue contar nem recuperar.

## Decisões já tomadas (2026-08-20/21)

Tomadas pelo João; registradas aqui para não serem reabertas por engano.

| Decisão | Escolha | Consequência |
|---|---|---|
| Consentimento LGPD | **Entra**, checkbox não pré-marcado | Duas colunas e um texto de finalidade na etapa 1 |
| Mapa em `/contato` | **Placeholder** até o cliente mandar o endereço | Bloco existe e é visivelmente provisório; não bloqueia a entrega |
| Quem lê os leads | **Tela no hub**, não e-mail nem planilha | Reusa login e controle de acesso existentes; nada externo |
| Controle de acesso | **Slug próprio** em `hub_system_access` | Admin sempre passa; comercial recebe acesso sem virar admin |
| Onde o CRM vai morar | **Dentro do hub** | O módulo nasce no namespace `/crm`, não em `/leads` |
| Colunas de workflow | **Ficam fora de `site_leads`** | Status, responsável e notas são do CRM, que define o próprio modelo |

### O que mudou depois de decidido, e por quê

A primeira rodada de decisões incluía status, responsável e notas dentro de `site_leads` —
um mini-CRM na própria tabela de captura. O João então definiu que o CRM viria de uma
infraestrutura própria e mais robusta, morando no hub. Isso invalidou aquelas colunas:
campos de workflow numa tabela de captura, com um CRM real chegando por cima, viram lixo
que ninguém tem coragem de dropar. **`site_leads` volta a ser só captura.**

## Parte 1 — captura no `manfac-site`

### Guard-rail

**Os 3 boxes de "qual é sua demanda" não mudam.** O João foi enfático mais de uma vez.
Muda a mecânica de envio, o bloco de contato ao lado e o mapa embaixo — nada além disso.

### Fluxo

| Etapa | Campos | O que acontece |
|---|---|---|
| **1 — Seus dados** | nome, telefone/WhatsApp, e-mail, consentimento | **Obrigatória.** Server Action grava a linha e devolve o `id` |
| **2 — Sua necessidade** | empresa, cargo, localidade, unidades, resumo | **Opcional.** `update` no mesmo `id`, carimbando `etapa2_em` |

O `path` escolhido nos 3 boxes vai gravado desde a etapa 1 — é ele que responde qual
demanda converte mais.

**A etapa 2 precisa de saída explícita.** Dois botões: "Enviar e falar no WhatsApp" e
**"Pular e falar agora"**. Sem o segundo, quem não quer preencher fecha a aba, e a etapa
opcional vira obrigatória na prática — perdendo justamente o lead que o desenho existe
para salvar.

O `wa.me` abre **por último**, com a mensagem montada como hoje. **Grava primeiro,
redireciona depois:** se o WhatsApp falhar, o lead já existe.

### Server Action

`app/contato/_actions.ts`, seguindo a convenção do repositório (`_actions.ts` ao lado da
página). Duas ações:

- `registrarLeadAction(dados)` → valida, grava, devolve `{ id }` ou erro
- `completarLeadAction(id, dados)` → `update` na linha existente; **nunca cria linha nova**

Ambas usam **service role**. Escrita anônima direta pelo navegador abriria a tabela para
qualquer um inserir o que quisesse.

**Validação no servidor, não só no formulário:** nome não vazio, e-mail com formato
plausível, telefone com dígitos suficientes, `consentimento === true`. Sem consentimento a
ação **rejeita** — é o que dá sentido ao checkbox.

**Anti-spam:** campo-armadilha invisível (honeypot) no formulário. Se vier preenchido, a
ação responde sucesso e **não grava** — robô não descobre que foi barrado. É a defesa
proporcional a um formulário deste tamanho; rate limit por IP exige estado compartilhado
que este app não tem.

### LGPD

Checkbox **não pré-marcado**, com a finalidade escrita ao lado:

> Autorizo a Manfac Engenharia a usar meus dados de contato para responder a esta solicitação.

Curto de propósito: cada promessa a mais no texto vira obrigação que a empresa tem de
cumprir. `consentimento` e `consentido_em` gravados na mesma linha do lead — o carimbo é o
que prova *quando* o aceite aconteceu.

### Bloco de contato e mapa

- **Contato ao lado do formulário:** WhatsApp e e-mail. Instagram e telefone fixo entram
  quando o cliente confirmar se existem.
- **Mapa embaixo, provisório:** bloco com a mesma área que o mapa vai ocupar, com aviso
  visível de endereço a confirmar. **Visivelmente provisório é requisito, não descuido** —
  um mapa apontando para um endereço aproximado é pior que nenhum mapa, porque manda
  cliente para o lugar errado.

## Parte 2 — leitura no hub

### Namespace: `/crm`, não `/leads`

O módulo nasce como **`/crm`**, slug `crm` em `lib/sistemas.ts`, com a lista de leads como
primeira tela. Quando o CRM real chegar, ele cresce dentro do mesmo namespace: mesma
entrada no `matcher`, mesmo slug, mesma concessão de acesso na `/admin/acessos`.

Criar `/leads` agora produziria dois cards no dashboard e duas permissões para gerenciar a
mesma coisa no dia em que o CRM entrasse.

### Integração com o que já existe

Tudo já tem molde no repositório — nada aqui é infraestrutura nova:

1. `lib/sistemas.ts` ganha `{ slug: 'crm', label: 'CRM' }`. É a fonte única: a
   `/admin/acessos` passa a oferecer o módulo automaticamente.
2. `middleware.ts` ganha `'/crm/:path*'` no `matcher`. **Rota fora do `matcher` fica
   aberta** — é a fronteira real de autorização, não a UI.
3. `app/(dashboard)/dashboard/page.tsx` ganha o card, no padrão dos três existentes
   (`hasSystemAccess` em `Promise.all`, admin curto-circuitando).
4. A página lê com `createAdminClient()` (`lib/supabase/admin.ts`) em Server Component.

### A tela

Lista ordenada por mais recente. Por lead: data, `path`, nome, telefone, e-mail e — quando
a etapa 2 veio — empresa, localidade e resumo. Telefone e e-mail clicáveis (`wa.me` e
`mailto:`), porque o próximo passo de quem abre essa tela é sempre entrar em contato.

**Sem ações de escrita.** Nada de status, responsável ou notas: isso é do CRM. A tela é
somente leitura, o que também significa que ela não pode corromper nada.

Distinção visível entre lead **completo** (etapa 2 veio) e **parcial** (só etapa 1) — o
lead parcial é exatamente o que hoje se perde, e quem atende precisa saber que tem menos
contexto em mãos antes de ligar.

Vazia, a tela diz que nenhum lead chegou ainda — não uma tabela de zero linhas, que se
confunde com erro de carregamento.

## Parte 3 — banco

`sdd-sql-site-leads.sql` na raiz, aplicado à mão no SQL Editor do projeto
**`iyytcavcgukfjnjjrerx`** (confirmar o ref antes de rodar — é o de produção). O projeto
não tem CLI de migration; código mergeado ≠ schema aplicado.

```
site_leads
  id             uuid primary key default gen_random_uuid()
  criado_em      timestamptz not null default now()
  atualizado_em  timestamptz
  path           text not null          -- qual dos 3 boxes
  nome           text not null
  email          text not null
  telefone       text not null
  consentimento  boolean not null
  consentido_em  timestamptz not null
  consentimento_texto text not null    -- o texto de TEXTO_CONSENTIMENTO no momento do aceite
  empresa        text                   -- etapa 2 em diante, tudo opcional
  cargo          text
  localidade     text
  unidades       text
  resumo         text
  etapa2_em      timestamptz            -- null = etapa 2 nunca veio
```

16 colunas ao todo. `consentimento_texto` guarda o texto de `TEXTO_CONSENTIMENTO` no momento
do aceite, não só o booleano e o carimbo: se `TEXTO_CONSENTIMENTO` mudar um dia, as linhas
antigas continuam apontando para o texto que a pessoa realmente aceitou, em vez de para um
texto novo que ninguém viu — decidido na revisão final da frente B (2026-08-21), enquanto o
SQL ainda não tinha sido aplicado em produção.

Índice em `criado_em desc` — é a única ordenação que a tela usa.

**RLS habilitada, nenhuma policy.** Nem `anon` nem `authenticated` leem ou escrevem. Todo
acesso passa por service role, dentro de Server Action ou Server Component. É o mesmo
padrão de `hub_user_roles` e `hub_system_access` depois do fechamento de 2026-08-10.

> **Cuidado ao escrever o SQL** — as duas armadilhas que já morderam neste projeto:
> trigger compartilhada entre tabelas de colunas diferentes (`new.campo` é resolvido contra
> o registro real, o `and` não protege), e guarda de autorização que falha **aberto** com
> `NULL`. Aqui não há trigger nem função de autorização prevista; se alguma aparecer na
> implementação, valem as duas regras.

## Fronteira com o CRM

**`site_leads` é registro de captura, imutável.** O que a pessoa preencheu e quando. O CRM
não altera essa tabela: cria as dele (`crm_*`) referenciando o `id` do lead.

Duas consequências que valem o custo:

1. O CRM nunca precisa migrar a tabela de captura. Repensar o CRM inteiro não põe em risco
   um único lead já gravado.
2. A captura continua funcionando com o CRM fora do ar, meio construído ou substituído.

## Testes

Em `__tests__/` ao lado do código, como o resto do repositório.

**No site:**
- `registrarLeadAction` grava e devolve `id`
- rejeita sem consentimento
- rejeita e-mail e telefone malformados
- honeypot preenchido: responde sucesso e **não grava**
- `completarLeadAction` atualiza o `id` existente e **nunca cria linha nova**
- a URL do `wa.me` continua sendo montada com os dados certos

**No hub:**
- `hasSystemAccess` com o slug `crm` decide quem entra
- lead parcial e lead completo se distinguem na tela
- lista vazia mostra o estado vazio, não uma tabela vazia

O Supabase é dublado nos testes de Server Action — o que se verifica é a decisão da ação
(gravou? rejeitou? atualizou em vez de inserir?), não o driver do banco.

## Riscos e pendências

### Depende do João, antes de a implementação valer

1. **Rodar o `sdd-sql-site-leads.sql`** no SQL Editor do Supabase.
2. **Pôr a `SUPABASE_SERVICE_ROLE_KEY` no app `manfac-site` do EasyPanel** — que hoje não
   tem variável de ambiente nenhuma. Formato `NOME=valor` **na mesma linha**: a chave é
   longa e a quebra de linha ao colar invalida tudo silenciosamente, e o container sobe sem
   variável. Foi exatamente o que aconteceu com o hub em 09/08. **Conferir pelo log do
   container, nunca pela tela do painel.**
3. **Endereço da empresa**, quando o cliente mandar.
4. **Texto do consentimento**: aprovar o proposto ou mandar o dele.

### Risco herdado

A tela de leads depende da **mesma `SUPABASE_SERVICE_ROLE_KEY` do hub** que sumiu do
processo em 09/08 sem aviso. Teste rápido antes de começar: se a `/admin/acessos` abre
normalmente, a chave está chegando; se ela dá erro genérico de Server Component, a de leads
daria o mesmo.

### Risco de produto

O formulário fica mais longo — checkbox é fricção, e fricção derruba conversão. A
contrapartida é que hoje a conversão medida é **zero**, porque nada é medido. A partir da
primeira semana de dados dá para saber quantos param na etapa 1, e aí a discussão deixa de
ser opinião.

## Fora de escopo

- **O CRM** — infra própria do João, trabalho separado, dentro do hub
- **Frente C (blog)** e **frente D (tradução)** — specs próprias; a tradução só depois da
  auditoria de copy/SEO
- **GA4 / analytics** — segue adiado; contar linhas em `site_leads` já responde a pergunta
  comercial principal
- **Notificação de lead novo** (e-mail, WhatsApp, push) — decidido contra por ora; a tela é
  o canal. Reavaliar quando houver volume que justifique
