# Ajustes v03 — Sistema Sofia (Gestão de Frotas)

**Data:** 2026-06-26  
**Status:** Aprovado pelo usuário  

---

## Contexto

O cliente revisou o sistema Sofia após o deploy da v02 e enviou uma lista de ajustes (AJUSTES V03 GF / MANFAC). Este spec cobre todos os itens confirmados em sessão de brainstorming com o usuário.

---

## 1. Labels de status de autorização (Multas, Sinistros, KM, Descontos)

**Escopo:** renomear rótulos exibidos no estado de autorização em todas as telas que os mostram.

| Estado (`autorizacao_status`) | Label anterior | Label novo |
|---|---|---|
| `sem_solicitacao` | "Não solicitado" | "não solicitado" |
| `solicitado` | "Solicitado · há X dias" | "solicitação feita - X dias sem resposta" |
| `autorizado` | "Autorizado" | "autorizado" |

**Arquivos afetados:**
- `app/(operacoes)/sofia/multas/_table.tsx` — função inline de label
- `app/(operacoes)/sofia/sinistros/page.tsx` — label inline
- `app/(operacoes)/sofia/km/page.tsx` — label inline no resumo mensal
- `app/(operacoes)/sofia/descontos/page.tsx` — label inline

A função `diasText()` existe em todos esses arquivos. Extrair para `lib/sofia/autorizacao.ts` como helper compartilhado para eliminar duplicação.

---

## 2. Descontos: botões de ação + linhas de KM excedido

### 2a. Botões Solicitar/Autorizar/Revogar em Descontos

A coluna "Autorização" em Descontos hoje exibe apenas o badge (read-only). Adicionar os mesmos botões inline já existentes em Multas e Sinistros:
- `sem_solicitacao` → botão "Solicitar"
- `solicitado` → botões "Autorizar" e "← Cancelar"
- `autorizado` → botão "← Revogar"

As actions chamam as mesmas server actions já existentes: `atualizarAutorizacaoMultaAction` e `atualizarAutorizacaoSinistroAction`, e a nova `atualizarAutorizacaoKmExcedidoAction` (ver seção 5).

### 2b. Linhas de KM excedido em Descontos

A tabela de Descontos passa a incluir registros de `km_excedido_desconto`. Tipo de linha:

```ts
type LinhaDesconto = {
  origem: 'multa' | 'sinistro' | 'km_excedido'
  // campos comuns: id, data, veiculoPlaca, motoristaNome, valor (km excedido = 0 de valor financeiro inicial)
  km_contratual?: number
  km_realizado?: number
  autorizacao_status: AutorizacaoStatus
  autorizacao_solicitado_em: string | null
}
```

Badge de origem: "KM Excedido" (cor âmbar).  
Valor exibido: `+X km` (quantidade de km excedida).

---

## 3. Motoristas: desativar (soft-delete)

- Adicionar `desativarMotoristaAction` em `app/(operacoes)/sofia/motoristas/_actions.ts` — seta `ativo = false`
- Na lista de motoristas: adicionar `DeleteConfirmButton` em cada linha com label "Desativar"
- No detalhe do motorista `[id]/page.tsx`: adicionar botão de desativar na zona de perigo
- Motoristas inativos: aparecem com badge "Inativo" cinza, ordenados ao final da lista
- Não há hard-delete — histórico de multas/sinistros/checklists vinculados é preservado

---

## 4. Revisões: coluna motorista + auto-fill no form

### 4a. Coluna motorista na lista

Adicionar coluna "Motorista" na tabela de revisões (`app/(operacoes)/sofia/revisoes/page.tsx`).  
Query: adicionar `motorista_id` na tabela `revisoes` e fazer join com `motoristas(nome)` na query `getRevisoes()`.

**SQL necessário:**
```sql
ALTER TABLE revisoes ADD COLUMN IF NOT EXISTS motorista_id uuid REFERENCES motoristas(id);
```

### 4b. Auto-fill motorista ao selecionar veículo no form

No form `nova/_form.tsx`:
1. Campo "Veículo" (select) já existe
2. Ao `onChange` do veículo, fazer fetch para `/api/sofia/veiculo-motorista?veiculo_id=X`
3. A API retorna o motorista atual de `veiculo_responsabilidade_historico` (registro com `fim IS NULL`)
4. Preencher campo "Motorista" (select read-only com override manual) automaticamente

Criar route handler: `app/api/sofia/veiculo-motorista/route.ts`

---

## 5. KM excedido: gatilho automático

Ao salvar um lançamento de KM (`criarKmAction` ou `upsertKmAction`), após inserir o registro:

1. Calcular soma de `km_atual` do mês corrente para o veículo
2. Se soma > `km_contratual_mensal` do veículo:
   - **Upsert** em `km_excedido_desconto` com `(veiculo_id, mes)` — se já existe, só atualiza `km_realizado`; se não existe, insere com `autorizacao_status = 'sem_solicitacao'`
   - **Criar pendência** em `pendencias` com:
     - `origem = 'km_excedido'` — adicionar este valor ao enum/check se necessário
     - `descricao = 'KM excedido — [placa] [mês/ano]'`
     - `status = 'aberta'`
   - Verificar se já existe pendência aberta para o mesmo veículo/mês antes de criar duplicata

**Nova server action:** `atualizarAutorizacaoKmExcedidoAction` em `app/(operacoes)/sofia/km/_actions.ts` — permite alterar `autorizacao_status` de um `km_excedido_desconto` (chamada a partir de Descontos e KM).

**SQL necessário:**
```sql
ALTER TABLE pendencias DROP CONSTRAINT IF EXISTS pendencias_origem_check;
ALTER TABLE pendencias ADD CONSTRAINT pendencias_origem_check
  CHECK (origem IN ('manual','multa','sinistro','manutencao','documento','termo','km_excedido'));
```

---

## 6. Custos: placa clicável + campo locação + coluna KM

### 6a. Placa clicável
Cada placa na tabela de Custos vira `<Link href={/sofia/veiculos/${l.veiculo.id}}>` com `hover:underline transition-colors`.

### 6b. Campo valor_locacao_mensal no form de veículo
O campo existe na tabela `veiculos` e é lido em Custos e no detalhe do veículo, mas não há input para preenchê-lo.

- Adicionar campo "Valor locação/mês (R$)" no form `veiculos/novo/_form.tsx`
- Adicionar edição inline no detalhe `veiculos/[id]/page.tsx` (form pequeno: input número + botão salvar)
- Criar `atualizarVeiculoAction` ou reutilizar action existente para salvar o valor

### 6c. Coluna KM contratado vs utilizado
Nova coluna na tabela de Custos: "KM mês" — mostra `km_contratual_mensal` vs km rodado no mês.  
Formato: `3.000 / 2.847 km` (contratado / rodado).  
Se excedido: exibir em vermelho `3.000 / 3.412 km ⚠`.  
Fonte: mesma query `getKmResumoMensal()` filtrada para o mês atual, indexada por `veiculo_id`.

---

## 7. Delete universal — padrão DeleteConfirmButton

Todos os deletes do sistema usam o componente `DeleteConfirmButton` com a frase de confirmação **"gestão de frotas"** (já implementada no componente).

| Módulo | Ação |
|---|---|
| Equipes | Soft-delete (`ativo = false`) com DeleteConfirmButton — mantém registros filhos |
| Multas | Substituir `window.confirm()` por DeleteConfirmButton (individual e em massa individual) |
| Sinistros | Adicionar DeleteConfirmButton — hard delete |
| Descontos | DeleteConfirmButton que deleta o registro de origem (multa ou sinistro ou km_excedido_desconto) |
| Abastecimento | ✅ já usa DeleteConfirmButton |
| Revisões | Adicionar DeleteConfirmButton — hard delete |
| Checklist | Adicionar DeleteConfirmButton — hard delete (nenhum delete existe hoje) |
| Veículos | ✅ já usa DeleteConfirmButton |
| KM Diário | ✅ já usa DeleteConfirmButton |
| Motoristas | ✅ nova feature (seção 3) |

**Nota sobre Descontos:** a tela de Descontos é uma view derivada (multas + sinistros + km_excedido). Deletar de lá remove o registro de origem. O label do botão deve deixar claro: "Excluir multa" / "Excluir sinistro" / "Excluir KM excedido".

---

## 8. Animações em elementos clicáveis (todo o sistema)

Aplicar em **todo o sistema** Sofia, não apenas em telas específicas.

**Padrão de classes Tailwind a aplicar:**

| Elemento | Classes |
|---|---|
| Linhas de tabela clicáveis | `hover:bg-[#0d2050] transition-colors cursor-pointer` |
| Botões primários | `active:scale-95 transition-transform` |
| Links de navegação | `hover:text-white transition-colors` |
| Cards clicáveis (equipes, veículos) | `hover:border-[#f05a28] transition-colors cursor-pointer` |
| Badges de status clicáveis | `hover:opacity-80 transition-opacity cursor-pointer` |
| Sidebar links | `active:scale-95 transition-transform` |

Garantir que elementos clicáveis tenham `cursor-pointer` explícito para feedback visual no mobile.

---

## 9. Cascade bidirecional em formulários (OBS4)

Em todos os formulários com seleção de equipe/veículo/motorista, implementar cascade bidirecional:

- **Selecionar equipe** → auto-preenche veículo vinculado + motorista vinculado  
- **Selecionar veículo** → auto-preenche equipe vinculada + motorista responsável atual  
- **Selecionar motorista** → auto-preenche equipe vinculada + veículo da equipe  

**Formulários afetados:** Multas (novo), Sinistros (novo), Revisões (novo), Checklist (já tem parte — verificar e completar).

**Implementação:** `onChange` nos selects dispara fetch para route handler `/api/sofia/veiculo-motorista` (mesma da seção 4). Os campos preenchidos automaticamente ficam em modo "sugerido" mas editáveis manualmente (o usuário pode sobrescrever).

---

## SQL migration consolidada

```sql
-- 1. revisoes: coluna motorista
ALTER TABLE revisoes ADD COLUMN IF NOT EXISTS motorista_id uuid REFERENCES motoristas(id);

-- 2. pendencias: adicionar km_excedido ao check constraint
ALTER TABLE pendencias DROP CONSTRAINT IF EXISTS pendencias_origem_check;
ALTER TABLE pendencias ADD CONSTRAINT pendencias_origem_check
  CHECK (origem IN ('manual','multa','sinistro','manutencao','documento','termo','km_excedido'));
```

> `km_excedido_desconto` e `valor_locacao_mensal` já existem no banco. Nenhuma outra migration necessária.

---

## Arquivos principais afetados

```
lib/sofia/autorizacao.ts                          ← novo helper compartilhado de labels
lib/sofia/types.ts                                ← PendenciaOrigem: adicionar 'km_excedido'

app/(operacoes)/sofia/multas/_table.tsx           ← labels + DeleteConfirmButton
app/(operacoes)/sofia/sinistros/page.tsx          ← labels + delete
app/(operacoes)/sofia/descontos/page.tsx          ← labels + botões + linhas KM + delete
app/(operacoes)/sofia/km/_actions.ts              ← gatilho auto + nova action autorização
app/(operacoes)/sofia/km/page.tsx                 ← labels
app/(operacoes)/sofia/revisoes/page.tsx           ← coluna motorista
app/(operacoes)/sofia/revisoes/nova/_form.tsx     ← auto-fill motorista
app/(operacoes)/sofia/revisoes/_actions.ts        ← salvar motorista_id
app/(operacoes)/sofia/motoristas/page.tsx         ← delete button
app/(operacoes)/sofia/motoristas/[id]/page.tsx    ← delete button
app/(operacoes)/sofia/motoristas/_actions.ts      ← desativarMotoristaAction
app/(operacoes)/sofia/veiculos/novo/_form.tsx     ← campo valor_locacao_mensal
app/(operacoes)/sofia/veiculos/[id]/page.tsx      ← edit inline locacao
app/(operacoes)/sofia/veiculos/_actions.ts        ← atualizarVeiculoAction
app/(operacoes)/sofia/custos/page.tsx             ← placa link + coluna KM
app/(operacoes)/sofia/equipes/page.tsx            ← delete button
app/(operacoes)/sofia/checklist/page.tsx          ← delete button
app/(operacoes)/sofia/checklist/_actions.ts       ← excluirChecklistAction
app/api/sofia/veiculo-motorista/route.ts          ← novo route handler
components/sofia/Sidebar.tsx                      ← animações
```

---

## Fora do escopo (v04+)

- Integração Ziv para multas
- Importação TICKETLOG/VELOE via CSV
- Importação histórica da planilha Excel
