# Gestão de Frotas v04 — Design

**Data:** 2026-07-18
**Status:** Em revisão

---

## Contexto

Cliente mandou feedback num Google Doc ("FEEDBACK V04 GESTAO DE FROTAS") com 3 pontos sobre o módulo de frota. Investigação no código (sessão de 2026-07-16/17) confirmou a causa raiz de cada um, e a auditoria completa do sistema (mesmo período) achou um bug de integridade de dado (`km_diario`) com a mesma raiz do item 1 — corrigido junto aqui para não mexer duas vezes no mesmo schema.

Fora de escopo desta spec: o pacote de segurança da auditoria (RLS, gate de admin em desconto, audit log) — adiado a pedido do cliente/dono, requer ação manual dele no Supabase e será tratado à parte.

---

## 1. Veículo na oficina + veículo provisório

**Problema relatado:** quando um carro bate e vai pra oficina, a equipe recebe um carro provisório — mas o sistema não tem como "pausar" o carro que foi pra oficina, e o vínculo do provisório com a equipe puxa dados antigos.

**Causa raiz:** `veiculos.status` já tem o valor `'manutencao'` no tipo, mas nenhuma action do sistema o define. O formulário de checklist é equipe-first e sempre auto-deriva o veículo do `equipe_id` atual — não existe seletor de veículo manual, então não há como atribuir um carro diferente do que já está salvo.

### Mudança de schema

```sql
alter table public.veiculos add column previsao_retorno_oficina date;
alter table public.veiculos add column substituto_id uuid references public.veiculos(id);
```

`substituto_id`, no veículo que foi pra oficina, aponta para o veículo que está cobrindo por ele agora (nulo se ninguém está cobrindo). Não precisa de coluna recíproca — dá pra descobrir "quem esse veículo está cobrindo" com uma query simples (`where substituto_id = <este id>`).

### Regra "1 equipe por carro não-inativo"

O pedido do item 3 do cliente ("não pode ter 2 equipes em 2 carros diferentes") é, na prática: uma mesma equipe não pode estar como responsável em 2 veículos não-inativos ao mesmo tempo.

```sql
create unique index veiculos_equipe_ativo_uniq
  on public.veiculos(equipe_id)
  where equipe_id is not null and status <> 'inativo';
```

Isso é o que torna o fluxo de oficina consistente: quando um veículo vai pra oficina, seu `equipe_id` **precisa** ser zerado (senão colide com o índice quando o provisório assumir a mesma equipe). "Pausado" = `status='manutencao'` + `equipe_id=null`, não "carro escondido" — ele continua listado, só sem responsável ativo.

### Novas actions (`veiculos/_actions.ts`)

- `enviarParaOficinaAction(veiculoId, previsaoRetorno?, observacao?)` — admin-only (segue o padrão de exclusões). Seta `status='manutencao'`, `equipe_id=null`, `previsao_retorno_oficina`. Fecha o registro aberto em `veiculo_responsabilidade_historico` (mesmo padrão do `troca`).
- `retornarDaOficinaAction(veiculoId)` — admin-only. Seta `status='ativo'`, `previsao_retorno_oficina=null`, `substituto_id=null` (em quem estava cobrindo, se houver — busca o veículo com esse `substituto_id` e limpa lá). **Não** reatribui a equipe automaticamente: o veículo volta disponível/sem equipe, e uma reatribuição é uma troca deliberada (checklist), igual qualquer outra.
- `atualizarEquipeVeiculoAction(veiculoId, equipeId | null)` — admin-only, nova. Permite editar a equipe de um veículo já cadastrado (resolve o item 3 do cliente ao pé da letra — hoje só dá pra setar equipe na criação). Valida a regra "1 equipe por carro" antes de gravar, devolvendo mensagem amigável ("Equipe já vinculada ao veículo X") em vez de deixar estourar a constraint do banco.

Essas 3 actions + `criarVeiculoAction` (que já seta `equipe_id` na criação) passam a compartilhar um único helper de validação, `lib/sofia/veiculos.ts` → `validarVinculoEquipeUnico(supabase, equipeId, veiculoIdExcluir?)`.

### Formulário de checklist — seletor de veículo explícito

`checklist/novo/_form.tsx` ganha um seletor de veículo visível quando `tipo === 'troca'`, em vez do `<input type="hidden">` auto-derivado da equipe. Isso corrige o bug relatado ("puxa o carro que estava com eles antes") — hoje o veículo de origem é sempre `veiculos.find(v => v.equipe_id === equipeId)`, que não existe mais depois que o veículo vai pra oficina (equipe_id limpo). Passa a listar veículos com `status IN ('ativo', 'manutencao')` sem equipe vinculada — cobrindo tanto "veículo do pátio" quanto, tecnicamente, um veículo que acabou de sair da oficina.

Ao concluir uma troca em que o veículo de origem tinha `substituto_id` setado por outro veículo (ou seja, esse veículo era ele mesmo um provisório saindo de uma equipe), nenhuma lógica nova é necessária — o fluxo de troca existente já atualiza `equipe_id` e fecha/abre `veiculo_responsabilidade_historico` corretamente.

### Descoberta do histórico do veículo

Não é bug de dado — a tela `/sofia/veiculos/[id]` já mostra "Histórico de responsabilidade". É só pouco descoberto. Fix mínimo: no card "Responsável atual" da tela de detalhe, adicionar uma âncora/rótulo mais explícito apontando pro histórico logo abaixo (já está na mesma tela, só reforça visualmente). Não entra card novo, não entra rota nova.

---

## 2. Novos tipos de checklist

**Problema relatado:** faltam os tipos `recebimento` (retirar da locadora), `devolução` (equipe devolve, carro fica parado na empresa) e `finalização de contrato` (devolver à locadora). Hoje só existe `saida`, `retorno`, `troca`.

### Mudança de schema

```sql
alter table public.checklist alter column equipe_id drop not null;
```

Necessário porque `recebimento` pode não ter equipe ainda (carro entra no pátio, sem dono) — hoje a coluna é `not null` e bloquearia esse caso.

### Novo tipo: `ChecklistTipo`

```ts
export type ChecklistTipo = 'recebimento' | 'saida' | 'retorno' | 'devolucao' | 'troca' | 'finalizacao_contrato'
```

| Tipo | Equipe obrigatória? | Efeito colateral na gravação |
|---|---|---|
| `recebimento` | Não | Se `equipe_destino_id` vier preenchido, atribui direto (mesmo mecanismo do `troca`); senão o veículo fica sem equipe (pool). |
| `devolucao` | Sim (é a equipe que está devolvendo) | Fecha o histórico de responsabilidade aberto, zera `veiculos.equipe_id`. Veículo continua `status='ativo'`, sem equipe — a tela de Disponibilidade já trata isso como "sem_motorista" (nenhuma lógica nova ali). |
| `finalizacao_contrato` | Não (pode already estar sem equipe) | Fecha histórico se houver, seta `veiculos.status='inativo'` — mesmo efeito do soft-delete manual, só que registrado via checklist. |
| `troca` | Sim (origem) + destino | Sem mudança de comportamento, além do seletor de veículo explícito do item 1. |
| `saida` / `retorno` | Sim | Sem mudança — uso diário, não mexe em vínculo. |

### Validação (`checklist/_validation.ts`)

```
if (!input.tipo || !input.veiculo_id) return 'Tipo e veículo são obrigatórios'
if (['saida','retorno','troca','devolucao'].includes(input.tipo) && !input.equipe_id)
  return 'Equipe é obrigatória para este tipo de checklist'
if (input.tipo === 'troca' && !input.equipe_destino_id)
  return 'Equipe de destino é obrigatória numa troca'
```

(`recebimento`/`finalizacao_contrato` seguem sem exigir `equipe_id`.)

### Formulário (`checklist/novo/_form.tsx`)

Select de "Tipo" ganha as 3 novas opções. Campo "Equipe" deixa de ser `required` no HTML quando o tipo é `recebimento`/`finalizacao_contrato` (a validação real continua no server, isso é só UX). `recebimento` reaproveita o bloco visual de "equipe de destino" já existente no `troca` (renomeado contextualmente para "Equipe (opcional)" nesse caso).

---

## 3. Vínculo carro↔equipe

Coberto pelas mudanças do item 1 (`atualizarEquipeVeiculoAction` + índice único `veiculos_equipe_ativo_uniq`). Complemento de UI: tela `/sofia/veiculos/[id]` ganha um pequeno formulário "Equipe responsável" (select + botão salvar), no mesmo padrão visual do formulário de "Locação mensal" que já existe ali — usando a nova action.

---

## Achado de auditoria incluído nesta migração (B-05)

`km_diario` usa `unique(data, equipe_id)`. Se uma equipe tiver 2 veículos ativos ao mesmo tempo — o cenário que este pacote inteiro resolve — o segundo lançamento de KM do dia sobrescreve o primeiro silenciosamente. Com a regra "1 equipe por carro" (item 1) isso deixa de poder acontecer *por equipe*, mas a chave certa continua sendo por veículo (é o veículo que roda, não a equipe em abstrato):

```sql
alter table public.km_diario drop constraint if exists km_diario_data_equipe_id_key;
alter table public.km_diario add constraint km_diario_data_veiculo_id_key unique (data, veiculo_id);
```

`lancarKmAction` (`km/_actions.ts`) muda o `onConflict` do upsert de `'data,equipe_id'` para `'data,veiculo_id'`.

**Nota para quem rodar a migração:** o nome real da constraint gerada pelo Postgres pode não ser exatamente `km_diario_data_equipe_id_key` — o `drop constraint if exists` com esse nome é uma tentativa direta; se falhar (constraint com outro nome), rodar `select conname from pg_constraint where conrelid = 'km_diario'::regclass and contype = 'u';` no SQL Editor do Supabase pra achar o nome certo antes de tentar de novo.

---

## Fora de escopo

- Pacote de segurança da auditoria (RLS, gates, audit log) — sessão separada, precisa de ação manual do João.
- Integração com locadora/TICKETLOG/VELOE (fase 2, não pedida agora).
- GPS/telemetria (fase 3, não pedida).
- Renomear rotas/pastas internas de `sofia` — decisão antiga, mantida.

## Testes

- `lib/sofia/__tests__/veiculos.test.ts` (novo): `validarVinculoEquipeUnico`.
- `app/(operacoes)/sofia/veiculos/__tests__/_actions.test.ts`: casos de `enviarParaOficinaAction`, `retornarDaOficinaAction`, `atualizarEquipeVeiculoAction` (sucesso, conflito de equipe já vinculada, gate de admin).
- `app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts`: casos de `recebimento`/`devolucao`/`finalizacao_contrato` (equipe opcional vs obrigatória).
- `app/(operacoes)/sofia/checklist/__tests__/_actions.*.test.ts`: efeito colateral de `devolucao` (zera equipe) e `finalizacao_contrato` (inativa veículo).
- `app/(operacoes)/sofia/km/__tests__/_actions.test.ts`: ajustar mock de `onConflict` para `'data,veiculo_id'`.
