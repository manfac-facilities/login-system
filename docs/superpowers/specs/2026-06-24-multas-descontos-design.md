# Multas + Descontos — Design Spec

**Data:** 2026-06-24
**Status:** Aprovado

---

## Contexto

O cliente revisou o sistema de Gestão de Frotas no ar e levantou pedidos específicos sobre o módulo de Multas e o fluxo de desconto. Esta spec cobre essa frente. As demais frentes (Checklist — bug da câmera + novos campos) têm spec própria, em separado.

Hoje o desconto (de multa) é um conjunto de campos (`tipo_desconto`, `valor_descontado`, `autorizacao_assinada`) que já existem em `multas` e `sinistros`, validados diretamente nessas telas. O pedido do cliente é: tirar essa validação de dentro de Multas/Sinistros e centralizar numa tela própria de Descontos, além de outros ajustes pontuais.

## Objetivo

1. Capturar a data em que a locadora enviou a multa (`data_recebimento`), separada da data da infração.
2. Trocar a descrição livre da infração por uma lista de tipos pré-definidos.
3. Mostrar com clareza, na própria tela de Multas, se um lançamento já foi pra desconto.
4. Permitir desfazer um desconto marcado por engano.
5. Permitir selecionar várias multas de uma vez e excluir ou enviar para desconto em lote.
6. Permitir excluir um lançamento errado (multa), restrito a administradores, com registro de auditoria.
7. Centralizar a validação do fluxo de desconto (de Multas e Sinistros) numa tela própria.

## Fora de escopo

- Sinistros não ganham seleção em massa nem botão de exclusão nesta frente — só Multas. A tabela `audit_log` é genérica e reaproveitável, mas o cliente só pediu exclusão para multas; estender para outros cadastros é trabalho futuro.
- Não há sistema de papéis/permissões configurável. "Admin" é uma lista fixa de 3 e-mails em código, no mesmo padrão de `lib/auth/domain.ts`. Adicionar/remover admin exige deploy.
- Exclusão é definitiva (hard delete). Não há "lixeira" ou recuperação — o registro de antes de excluir fica só no `audit_log`, como histórico, não como mecanismo de undo.
- Integração com Ziv (campo `ziv_task_id` já existe em `multas`, não usado) continua fora de escopo.
- Log de auditoria nesta frente cobre apenas **criação** e **exclusão** de multas — não loga edições (`UPDATE`). Cobrir updates é extensão futura natural da mesma tabela, sem mudança de schema.

---

## 1. Banco de dados

### 1.1 Alteração em `multas`

| Coluna | Tipo | Observação |
|---|---|---|
| `data_recebimento` | `date`, nullable | Data em que a locadora enviou a multa. Obrigatório no formulário de cadastro (validação na action), não há `NOT NULL` no banco para não quebrar linhas existentes. |
| `tipo_infracao` | `text`, nullable | Um dos valores da lista da seção 2. Obrigatório no formulário de cadastro daqui pra frente; linhas antigas ficam `null` e exibem "—". |

`descricao` deixa de ser obrigatória (`alter column descricao drop not null`) e passa a representar "Detalhes adicionais" — campo de texto livre, opcional, complementar ao `tipo_infracao`.

### 1.2 Alteração em `sinistros`

| Coluna | Tipo | Observação |
|---|---|---|
| `status_desconto` | `text not null default 'pendente'` | Estado do fluxo de desconto (`pendente` / `validada` / `descontada`), independente do `status` do sinistro (`aberto` / `em_tratativa` / `encerrado`), que continua representando a tratativa do caso. |

### 1.3 Nova tabela `audit_log`

```sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('criacao', 'exclusao')),
  dados jsonb not null,
  usuario_email text,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
create policy "authenticated full access" on public.audit_log
  for all to authenticated using (true) with check (true);
```

`dados` guarda o snapshot completo da linha (insert: a linha recém-criada; exclusão: a linha antes de ser apagada). `tabela` + `registro_id` permitem reconstruir o histórico de um registro específico mesmo após ele ser excluído.

### 1.4 Ajuste de FK

`motorista_documentos.multa_id` hoje referencia `multas(id)` sem `ON DELETE` explícito (= `NO ACTION`, bloqueia a exclusão se existir documento vinculado). Passa a ser `ON DELETE SET NULL`:

```sql
alter table public.motorista_documentos
  drop constraint motorista_documentos_multa_id_fkey,
  add constraint motorista_documentos_multa_id_fkey
    foreign key (multa_id) references public.multas(id) on delete set null;
```

---

## 2. Lista de tipos de infração

Select fixo no formulário de cadastro de multa, com opção "Outra" que libera um campo de texto livre (gravado em `tipo_infracao` mesmo, valor digitado pelo usuário):

1. Excesso de velocidade
2. Avanço de sinal vermelho
3. Estacionamento irregular
4. Uso de celular ao dirigir
5. Não uso de cinto de segurança
6. Ultrapassagem proibida
7. Embriaguez ao volante
8. Trafegar na contramão
9. Não respeitar faixa de pedestre
10. Estacionamento em vaga reservada sem credencial
11. CNH vencida ou ausente
12. Documento do veículo vencido
13. Falta de pagamento de pedágio/tag
14. Outra (especificar)

---

## 3. Tela nova: Descontos (`/sofia/descontos`)

Lista unificada, somando linhas de `multas` e `sinistros`, cada uma com um indicador de origem (badge "Multa" ou "Sinistro"). Colunas: Origem, Data, Veículo, Motorista, Valor, Status do desconto, Ações.

- **Status do desconto:** `pendente` → `validada` → `descontada`, lido de `multas.status` (origem multa) ou `sinistros.status_desconto` (origem sinistro). Mesmos rótulos e cores já usados hoje em Multas.
- **Ação "avançar status":** mesma lógica que hoje existe em Multas (`pendente → validada`, `validada → descontada`), aplicada à tabela correta conforme a origem da linha.
- **Formulário de desconto** (visível a partir de `validada`): `valor_descontado`, `tipo_desconto`, `autorizacao_assinada` — mesmo formulário que hoje fica embutido em Multas, mas grava na tabela de origem (`multas` ou `sinistros`).
- **Desfazer desconto:** botão visível quando status = `descontada`, volta para `validada`. Não reverte `tipo_desconto`/`valor_descontado`/`autorizacao_assinada` — só o status, para permitir corrigir e salvar de novo.

Arquivos: `app/(operacoes)/sofia/descontos/page.tsx`, `app/(operacoes)/sofia/descontos/_actions.ts`.

---

## 4. Tela de Multas (`app/(operacoes)/sofia/multas/`)

### Mudanças na listagem (`page.tsx`)

- **Remove:** formulário de desconto embutido (`<details>` com `registrarDescontoMultaAction`) e o botão "→ validada/descontada". O fluxo de validação migra para a tela de Descontos.
- **Mantém:** badge de status (`pendente`/`validada`/`descontada`), agora somente leitura — é o indicador que o cliente pediu ("onde eu sei se foi pra desconto ou não").
- **Adiciona colunas:** "Tipo de infração" (com fallback "—" para linhas antigas) e "Data de recebimento".
- **Adiciona seleção em massa:** checkbox por linha + checkbox "selecionar todas" no cabeçalho. Quando ≥1 selecionada, aparece uma barra de ações com:
  - **"Enviar para desconto"** — para cada multa selecionada com `status = 'pendente'`, atualiza para `'validada'`. Ignora silenciosamente as que já não estão em `pendente`.
  - **"Excluir selecionadas"** — visível só para admin (seção 6). Pede confirmação (quantidade de itens). Para cada multa, grava snapshot em `audit_log` (`acao = 'exclusao'`) e então exclui a linha.
- **Adiciona ação por linha:** "Excluir" (ícone/botão), visível só para admin — mesmo comportamento da exclusão em massa, para 1 item.

### Mudanças no cadastro (`nova/_form.tsx`, `_actions.ts`)

- Campo "Descrição da infração" (texto livre, obrigatório) é substituído por "Tipo de infração" (select da seção 2, obrigatório) + campo "Outra" condicional.
- Novo campo "Data de recebimento" (date, obrigatório), ao lado de "Data da infração".
- Campo "Detalhes adicionais" (era "Descrição", `descricao`) passa a opcional, reposicionado abaixo do tipo de infração.
- `criarMultaAction`: depois do insert com sucesso, grava snapshot em `audit_log` (`acao = 'criacao'`).

---

## 5. Tela de Sinistros

- **Listagem (`page.tsx`):** nenhuma mudança — a coluna "Desconto" já existe e já é somente leitura (mostra `—` ou `Total/Parcial · R$ X`), que é exatamente o indicador pedido.
- **Detalhe (`[id]/_form.tsx`, componente `TratativaForm`):** remove os campos `valor_descontado`, `tipo_desconto` e `autorizacao_assinada` do formulário — esses três passam a ser editados exclusivamente na tela de Descontos. O formulário de tratativa fica só com o campo `status` (aberto/em_tratativa/encerrado), que é a tratativa do caso em si.

---

## 6. Admin e permissões

Novo arquivo `lib/auth/admins.ts`, no mesmo padrão de `lib/auth/domain.ts`:

```ts
const ADMIN_EMAILS = [
  'ewerton.silva@manfac.com.br',
  'jose.guilherme@manfac.com.br',
  'jvictorco28@gmail.com',
]

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
```

- **Servidor:** toda action de exclusão (unitária ou em massa) busca o usuário autenticado (`supabase.auth.getUser()`) e chama `isAdminEmail(user.email)` antes de excluir. Se não for admin, retorna erro — sem exceção, mesmo que o botão não devesse aparecer na tela.
- **Cliente:** os botões "Excluir" (linha e em massa) só renderizam se o e-mail da sessão atual estiver em `ADMIN_EMAILS` — verificado no server component da página (`page.tsx` já é `async` e já busca dados via Supabase; busca o usuário do mesmo jeito).

---

## 7. Testes

Seguindo o padrão já usado em `app/(operacoes)/sofia/multas/__tests__/_actions.test.ts` e `app/(operacoes)/sofia/abastecimento/__tests__/_actions.test.ts`:

- `criarMultaAction`: grava `tipo_infracao` e `data_recebimento`; grava entrada em `audit_log` com `acao = 'criacao'`.
- `excluirMultaAction` / `excluirMultasEmMassaAction`: bloqueia usuário não-admin; grava entrada em `audit_log` com `acao = 'exclusao'` antes de excluir; admin consegue excluir.
- `enviarParaDescontoEmMassaAction`: só altera as multas em `status = 'pendente'`, ignora as demais.
- Descontos: avançar status (multa e sinistro), registrar desconto (multa e sinistro), desfazer desconto (volta `descontada` → `validada`).

---

## Resumo de arquivos

| Arquivo | Mudança |
|---|---|
| SQL (migração Supabase) | `multas` (2 colunas + drop not null), `sinistros` (1 coluna), `audit_log` (nova tabela + RLS), FK de `motorista_documentos.multa_id` |
| `lib/sofia/types.ts` | `Multa.data_recebimento`, `Multa.tipo_infracao`, `Sinistro.status_desconto`, novo tipo `AuditLog` |
| `lib/auth/admins.ts` | Novo — lista de e-mails admin |
| `app/(operacoes)/sofia/multas/page.tsx` | Remove form de desconto embutido, adiciona colunas, seleção em massa, exclusão |
| `app/(operacoes)/sofia/multas/_actions.ts` | `criarMultaAction` (campos novos + audit log), novas actions de exclusão e envio em massa |
| `app/(operacoes)/sofia/multas/nova/_form.tsx` | Campos novos (tipo de infração, data de recebimento), descrição opcional |
| `app/(operacoes)/sofia/sinistros/page.tsx` | Sem mudança de lógica (confirmação) |
| `app/(operacoes)/sofia/sinistros/[id]/_form.tsx` | Remove campos de desconto do formulário de tratativa |
| `app/(operacoes)/sofia/descontos/page.tsx` | Novo — listagem unificada |
| `app/(operacoes)/sofia/descontos/_actions.ts` | Novo — avançar status, registrar desconto, desfazer |
