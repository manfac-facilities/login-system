# Cancelamento de obra — Plano de implementação

> **Para agentes:** use `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans`, tarefa por tarefa. Os passos usam checkbox (`- [ ]`).
> **TDD em toda tarefa:** o teste é escrito primeiro, roda e **falha pelo motivo certo**; só então
> o código; o teste passa; commit.

**Objetivo:** cancelar obra (até `paralisado`), com quem cancelou e observação opcional; obra cancelada
só leitura, fora do diário, das tarefas abertas, do Kanban e dos indicadores; desfazer volta à etapa
exata; histórico nas duas pontas. Mockup aprovado em 23/09.

**Spec:** `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-cancelamento-obra-2026-09-23.md`.
Toda regra, texto de tela e arquivo:linha citado aqui vem de lá. Na dúvida, a spec manda; se a spec
contradisser o mockup `mockup-cancelamento-obra-2026-09-23.html`, **pare e pergunte**.

**Migration:** `sdd-sql-obras-cancelamento.sql` (raiz) — **já escrita, não aplicada**. Nenhuma tarefa
de código aplica SQL nem acessa o banco de produção. O código roda nos testes com Supabase mockado;
o teste manual (T14) só depois de o João aplicar a migration.

**Stack:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em Server Action/Component),
Supabase (RPC `obras_aplicar_alteracao`), Jest (next/jest, SWC — **não checa tipo**: por isso o
`tsc` depois de cada tarefa), React Testing Library + `userEvent`, Tailwind v4 com hex literais do
módulo.

## Restrições globais

- **`_actions.ts` é `'use server'`: só exporta funções `async`.** Nada de `export type`/`export const`
  novo lá (armadilha 1 de `.claude/rules/obras.md`). Regras e constantes vão para `_lib/tipos.ts`;
  tipos de prop ficam nos componentes.
- `null` é o único sentinela de vazio; nunca gravar `""` (`_actions.ts:11-12`).
- Cancelar e desfazer gravam **só** por `gravarComHistorico` (uma chamada = uma transação). Nunca
  `update` direto em `obras_obra` para o cancelamento.
- `desde_etapa` **nunca** entra em `campos` no cancelar nem no desfazer.
- Actions entram nos componentes da ficha **por prop** (`_ficha.tsx:17-22`); a Triagem importa direto
  (padrão do próprio arquivo, `_triagem.tsx:52`).
- Menor mudança. Sem tratamento de erro além do que a spec lista. Borda nova → anote para a T14, não
  trate.
- Caminhos com `[id]`: no jest, regex com `.id.` no lugar de `[id]`
  (ex.: `npx jest "app/obras/obra/.id./__tests__/_actions.test"`).
- Depois de cada tarefa: o teste da tarefa passa, os testes antigos do mesmo arquivo passam e
  `npx tsc --noEmit` não acusa erro novo.
- Commits pequenos, um por tarefa, `feat(obras): ...` / `test(obras): ...`, terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Não pushar.**
- **Não tocar** em `docs/onboarding-duda/`. Em `app/obras/tarefas/page.tsx`, **só** o que a T8 diz.

## Paralelismo

Critério: duas tarefas só rodam juntas se **não tocam o mesmo arquivo** (código nem teste).

| Onda | Tarefas (em paralelo dentro da onda) | Depende de |
|---|---|---|
| 1 | **T1**, **T2**, **T3** | — |
| 2 | **T4**, **T6**, **T7**, **T8**, **T9**, **T10** | todas ← T1; T4 ← T2 (bloco `Cancelamento`) |
| 3 | **T5**, **T11**, **T12** | T5 ← T4 (mesmo `_actions.ts`); T11 ← T6 (`_visao` usa `canceladasFora`); T12 ← T4 (actions), T9 |
| 4 | **T13** | T3, T4, T5, T7, T9, T10 (é a tarefa que liga tudo na ficha) |
| 5 | **T14** | todas |

Mapa de arquivos, para conferir o critério:

| Tarefa | Arquivos |
|---|---|
| T1 | `app/obras/_lib/tipos.ts`, `app/obras/__tests__/tipos.test.ts`; fallout de `tsc` **só de tipo** em `app/obras/base/_regras.ts` (`COR_ETAPA`, `ordenar`) e `app/obras/obra/[id]/_actions.ts` (casts `EtapaCiclo`) |
| T2 | `app/obras/_lib/historico.ts`, `app/obras/obra/[id]/_historico.tsx`, `app/obras/__tests__/historico.test.ts`, `app/obras/obra/[id]/__tests__/_historico.test.tsx` |
| T3 | `app/obras/obra/[id]/_bloco-editavel.tsx`, `_bloco-autorizacao.tsx`, `_bloco-identificacao.tsx`, `_bloco-cronograma.tsx`, `app/obras/obra/[id]/__tests__/_blocos-editaveis.test.tsx` |
| T4 | `app/obras/obra/[id]/_actions.ts`, `app/obras/obra/[id]/__tests__/_actions.test.ts` |
| T5 | `app/obras/obra/[id]/_actions.ts`, `app/obras/obra/[id]/__tests__/_actions.test.ts`, `app/obras/__tests__/ficha-editavel.test.ts` |
| T6 | `app/obras/base/_regras.ts`, `app/obras/__tests__/base.test.ts` |
| T7 | `app/obras/base/_etiquetas.tsx`, `app/obras/__tests__/etiquetas.test.tsx` |
| T8 | `app/obras/tarefas/page.tsx`, `app/obras/tarefas/__tests__/page.test.tsx` (novo) |
| T9 | `app/obras/obra/[id]/_cancelar-obra.tsx` (novo), `app/obras/obra/[id]/__tests__/_cancelar-obra.test.tsx` (novo) |
| T10 | `app/obras/obra/[id]/_cancelamento.tsx` (novo), `app/obras/obra/[id]/__tests__/_cancelamento.test.tsx` (novo) |
| T11 | `app/obras/base/_visao.tsx`, `app/obras/base/__tests__/_visao.test.tsx` (novo) |
| T12 | `app/obras/obra/[id]/_triagem.tsx`, `app/obras/obra/[id]/__tests__/_triagem-cancelar.test.tsx` (novo) |
| T13 | `app/obras/obra/[id]/_ficha.tsx`, `app/obras/obra/[id]/__tests__/_ficha.test.tsx`, `app/obras/obra/[id]/__tests__/page.test.tsx` |
| T14 | `docs/DIVIDAS.md` |

**Quem executa não revisa.** Depois de cada onda, um agente diferente do executor confere o diff
contra a spec antes da onda seguinte. Na onda 1, a T1 tem o maior raio de alcance do módulo
(`tipos.ts` é o arquivo mais importado): a revisão dela é a que mais importa.

---

### Tarefa 1: `tipos.ts` — a etapa `cancelado` e as regras de leitura

**Arquivos:** `app/obras/_lib/tipos.ts` · teste `app/obras/__tests__/tipos.test.ts` · fallout de
tipo em `app/obras/base/_regras.ts` e `app/obras/obra/[id]/_actions.ts` (spec §4).

**Produz:** `EtapaCiclo`; `Etapa = EtapaCiclo | 'cancelado'`; em `ObraRow` os cinco `cancelado_*`
**opcionais**; `CANCELADO_POR`, `rotuloCancelado`, `PODE_CANCELAR`, `NOME_CANCELADA`, `cancelada`,
`podeCancelar`, `tarefaVisivelNaLista`; `faseDe(): Fase | null`.

- [ ] **Teste primeiro** — novo `describe('cancelamento — regras de leitura')` no fim de
  `tipos.test.ts` (use o `obraRow(...)` do próprio arquivo; `derivar` com `HOJE` fixo):

```ts
const canc = (over: Partial<ObraRow> = {}) =>
  obraRow({ etapa: 'cancelado', cancelado_por: 'cliente', cancelado_etapa_anterior: 'andamento',
    cancelado_em: '2026-09-23T13:42:00Z', cancelado_quem: 'rafael.souza@manfac.com.br', ...over })

it('nome, rótulos e quem pode cancelar', () => {
  expect(nomeEtapa('cancelado')).toBe('Cancelada')
  expect(rotuloCancelado('cliente')).toBe('Cancelado pelo Cliente')
  expect(rotuloCancelado('manfac')).toBe('Cancelado pela Manfac')
  expect(PODE_CANCELAR).toEqual(['definir', 'levantamento', 'andamento', 'paralisado'])
  expect(podeCancelar(obraRow({ etapa: 'paralisado' }))).toBe(true)
  expect(podeCancelar(obraRow({ etapa: 'relatorio' }))).toBe(false)
  expect(podeCancelar(canc())).toBe(false)
})
it('não entra no ciclo: o seletor de etapa não a oferece', () => {
  expect(CICLO.map((c) => c.k)).not.toContain('cancelado')
})
it('não tem fase: fora do Kanban, não pede foto, não é pós-campo', () => {
  expect(faseDe(canc())).toBeNull()
  expect(posCampo(canc())).toBe(false)
  expect(pedeFoto(canc())).toBe(false)
})
it('etapa realmente desconhecida continua caindo em "campo" (comportamento antigo)', () => {
  expect(faseDe(obraRow({ etapa: 'xyz' as Etapa }))).toBe('campo')
})
it('é encerrada: sem alarme de nenhum tipo', () => {
  const o = derivar(canc({ aprovacao: '2026-01-01', inicio_plan: '2026-01-02', duracao: 5,
    bloqueio: 'Clima', bloqueada_dias: 9 }), HOJE)
  expect(encerrada(o)).toBe(true)
  expect(sev(o)).toBe('encerrada')
  expect(critico(o)).toBe(false)
  expect(estourou(o)).toBe(false)
  expect(travado(o)).toBe(false)
  expect(semCobertura(o)).toBe(false)
  expect(classeDias(o)).toBe('')
  expect(donoDa(o)).toBe('—')
})
it('derivar zera o que conta dias e prazo', () => {
  const o = derivar(canc({ aprovacao: '2026-01-01', inicio_plan: '2026-01-02', duracao: 5,
    desde_etapa: '2026-09-01' }), HOJE)
  expect([o.diasAlerta, o.atraso, o.diaDe, o.fracPrazo, o.paradaEtapa]).toEqual([null, null, null, null, null])
})
it('tarefa aberta de obra cancelada some; respondida fica; obra ativa não muda', () => {
  const t = (situacao: 'aberta' | 'respondida') => ({ situacao }) as TarefaRow
  expect(tarefaVisivelNaLista(t('aberta'), 'cancelado')).toBe(false)
  expect(tarefaVisivelNaLista(t('respondida'), 'cancelado')).toBe(true)
  expect(tarefaVisivelNaLista(t('aberta'), 'andamento')).toBe(true)
  expect(tarefaVisivelNaLista(t('aberta'), undefined)).toBe(true)
})
```

- [ ] Ver falhar: `npx jest app/obras/__tests__/tipos.test.ts`
- [ ] **Implementar** (spec §4.1–§4.3): dividir o tipo (`EtapaInfo.k`, `ETAPAS`, `ESTEIRA` em
  `EtapaCiclo`); `faseDe` com `if (o.etapa === 'cancelado') return null` antes do lookup;
  `encerrada` inclui `cancelado`; `estourou`/`travado` com `if (encerrada(o)) return false` no topo;
  `donoDa` e `nomeEtapa` tratam `cancelado` antes do lookup; `derivar` com um `const canc =
  cancelada(o)` que força os cinco derivados a `null`. `ObraRow`: campos com `?:` e comentário
  apontando a spec §4.1.
- [ ] Rodar `npx tsc --noEmit` e corrigir **só o que ele apontar, só no tipo**: em `_regras.ts`,
  `COR_ETAPA.cancelado = '#64748b'` e `ordenar` usando `nomeEtapa(o.etapa)`; em `_actions.ts`,
  `ORDEM_ETAPA`/`PASSOS_MARCO`/`calcularMarcosDaEsteira`/`ETAPAS_VALIDAS` com `EtapaCiclo` e os casts
  `as Etapa` → `as EtapaCiclo`. Nenhuma mudança de comportamento nesses dois arquivos (a T4 e a T6
  cuidam). Se o `tsc` apontar arquivo fora desta lista, **pare e relate**.
- [ ] Ver passar, e também `npx jest app/obras/__tests__/base.test.ts "app/obras/obra/.id./__tests__/_actions.test"`
  (prova de que o fallout não mudou comportamento). Commit.

---

### Tarefa 2: histórico — bloco `Cancelamento`

**Arquivos:** `app/obras/_lib/historico.ts:15-20`, `app/obras/obra/[id]/_historico.tsx:16` · testes
`app/obras/__tests__/historico.test.ts`, `app/obras/obra/[id]/__tests__/_historico.test.tsx` (spec §6.4).

- [ ] **Teste primeiro:**

```ts
// historico.test.ts
it('bloco Cancelamento: a linha da etapa sai com o nome "Cancelada"', () => {
  const [l] = linhasDeAlteracao({ etapa: 'andamento' }, { etapa: 'cancelado' }, 'Cancelamento')
  expect(l).toEqual({ bloco: 'Cancelamento', campo: 'etapa', de: 'Em andamento', para: 'Cancelada', motivo: null })
})
```

```tsx
// _historico.test.tsx
test('filtro "Cancelamento" mostra só as linhas do cancelamento, com o motivo', async () => {
  // duas linhas: uma 'Cronograma', uma 'Cancelamento' com motivo 'Cancelado pelo Cliente — loja suspensa'
  // clicar no botão "Cancelamento" → só a segunda aparece, com "Motivo: Cancelado pelo Cliente — loja suspensa"
})
```

- [ ] Ver falhar: `npx jest app/obras/__tests__/historico.test.ts "app/obras/obra/.id./__tests__/_historico"`
  (a primeira falha só depois da T1 no mesmo branch — se rodar em paralelo à T1, o `para` sai
  `'cancelado'`; aceite essa falha como "pelo motivo certo" e confira de novo ao juntar a onda.)
- [ ] **Implementar:** `'Cancelamento'` no fim de `BlocoHistorico` e de `FILTROS`.
- [ ] Ver passar. Commit.

---

### Tarefa 3: blocos editáveis com `somenteLeitura`

**Arquivos:** `app/obras/obra/[id]/_bloco-editavel.tsx:224-301`, `_bloco-autorizacao.tsx`,
`_bloco-identificacao.tsx`, `_bloco-cronograma.tsx` · teste
`app/obras/obra/[id]/__tests__/_blocos-editaveis.test.tsx` (spec §6.5).

- [ ] **Teste primeiro**, no fim do arquivo, um por bloco (mesmos `render` já usados no arquivo):

```tsx
test.each(['Autorização', 'Identificação', 'Cronograma'])(
  '%s com somenteLeitura: mostra os valores e não tem Editar', (titulo) => {
    renderBloco(titulo, { somenteLeitura: true }) // helper local que monta o bloco certo
    expect(screen.queryByRole('button', { name: `Editar ${titulo}` })).not.toBeInTheDocument()
  })
test('sem a prop, o Editar continua lá (comportamento de hoje)', () => {
  renderBloco('Cronograma', {})
  expect(screen.getByRole('button', { name: 'Editar Cronograma' })).toBeInTheDocument()
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_blocos-editaveis"`
- [ ] **Implementar:** `somenteLeitura?: boolean` em `BlocoEditavel`; com `true`, não desenha o botão
  Editar (`:283-290`). Os três blocos aceitam e repassam. Nada mais muda.
- [ ] Ver passar (os testes antigos do arquivo também). Commit.

---

### Tarefa 4: `cancelarObraAction` e `desfazerCancelamentoAction`

**Arquivos:** `app/obras/obra/[id]/_actions.ts` · teste `app/obras/obra/[id]/__tests__/_actions.test.ts`
(spec §5.1, §5.2). Território de exceção do AGENTS.md: **toda guarda da spec é obrigatória**.

- [ ] **Teste primeiro** — dois `describe` novos, reaproveitando `obra()`, `rpcMock`, `camposMarco()`,
  `linhasMarco()` e `revalidatePath` do arquivo:

```ts
describe('cancelarObraAction', () => {
  it('recusa sem acesso, sem ler a obra', async () => { /* hasSystemAccess false → SEM_ACESSO; fromMock não chamado */ })
  it('recusa "por" fora de cliente/manfac, sem gravar', async () => {
    expect(await cancelarObraAction('o1', { por: 'outro' })).toEqual({ error: 'Escolha quem cancelou: o Cliente ou a Manfac.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it.each(['relatorio', 'aprovarOS', 'fecharOS', 'pendFat', 'faturado'])('2B: recusa obra em %s', async (etapa) => {
    obraAtual = obra({ etapa })
    expect(await cancelarObraAction('o1', { por: 'cliente' })).toEqual({ error: 'Esta obra já foi executada em campo e não pode ser cancelada.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('recusa obra já cancelada', async () => { /* etapa 'cancelado' → 'Esta obra já está cancelada. Recarregue a página.' */ })
  it.each(['definir', 'levantamento', 'andamento', 'paralisado'])('cancela de %s numa chamada só da RPC', async (etapa) => {
    obraAtual = obra({ etapa, desde_etapa: '2026-09-01' })
    expect(await cancelarObraAction('o1', { por: 'manfac', obs: '  OS duplicada  ' })).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock.mock.calls[0][0]).toBe('obras_aplicar_alteracao')
    const c = camposMarco()!
    expect(c).toMatchObject({ etapa: 'cancelado', cancelado_por: 'manfac', cancelado_obs: 'OS duplicada',
      cancelado_quem: EMAIL, cancelado_etapa_anterior: etapa, etapa_por: EMAIL, atualizacao: HOJE })
    expect(typeof c.cancelado_em).toBe('string')
    expect(c).not.toHaveProperty('desde_etapa')
    expect(linhasMarco()).toEqual([expect.objectContaining({ bloco: 'Cancelamento', campo: 'etapa',
      para: 'Cancelada', motivo: 'Cancelado pela Manfac — OS duplicada' })])
  })
  it('observação vazia vira null e o motivo fica só com quem cancelou', async () => {
    await cancelarObraAction('o1', { por: 'cliente', obs: '   ' })
    expect(camposMarco()!.cancelado_obs).toBeNull()
    expect(linhasMarco()[0].motivo).toBe('Cancelado pelo Cliente')
  })
  it('falha da RPC vira mensagem, sem lançar', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await cancelarObraAction('o1', { por: 'cliente' })).toEqual({ error: 'Não deu para cancelar a obra. Nada mudou — tente de novo.' })
  })
  it('revalida ficha, base, diário e tarefas', async () => { /* 4 revalidatePath */ })
})

describe('desfazerCancelamentoAction', () => {
  const cancelada = () => obra({ etapa: 'cancelado', cancelado_por: 'cliente', cancelado_obs: 'x',
    cancelado_em: '2026-09-23T13:42:00Z', cancelado_quem: EMAIL, cancelado_etapa_anterior: 'paralisado',
    desde_etapa: '2026-09-01' })
  it('recusa obra que não está cancelada', async () => { /* 'Esta obra não está cancelada. Recarregue a página.' */ })
  it('recusa quando a etapa anterior não está registrada', async () => {
    obraAtual = { ...cancelada(), cancelado_etapa_anterior: null }
    expect(await desfazerCancelamentoAction('o1')).toEqual({ error: 'Não dá para desfazer: a etapa anterior não está registrada.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('volta à etapa exata, limpa as cinco colunas, não toca em desde_etapa, registra no histórico', async () => {
    obraAtual = cancelada()
    expect(await desfazerCancelamentoAction('o1')).toEqual({ success: true })
    expect(camposMarco()).toMatchObject({ etapa: 'paralisado', cancelado_por: null, cancelado_obs: null,
      cancelado_em: null, cancelado_quem: null, cancelado_etapa_anterior: null })
    expect(camposMarco()).not.toHaveProperty('desde_etapa')
    expect(linhasMarco()).toEqual([expect.objectContaining({ bloco: 'Cancelamento', de: 'Cancelada',
      para: 'Paralisado', motivo: 'Cancelamento desfeito' })])
  })
  it('falha da RPC vira mensagem', async () => { /* 'Não deu para desfazer o cancelamento. Nada mudou — tente de novo.' */ })
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_actions.test"`
- [ ] **Implementar** exatamente spec §5.1 e §5.2: `abrirSessao` → validar `por` → `lerObra` → guardas
  → `campos` → `linhasDeAlteracao(..., 'Cancelamento')` com o `motivo` montado → `gravarComHistorico`
  → quatro `revalidatePath`. Mensagens como `const` **não exportadas**. `hojeISO()` para
  `atualizacao`; `new Date().toISOString()` para `cancelado_em`/`etapa_em`.
- [ ] Ver passar. Rodar também `npx jest __tests__/use-server-exports-async.test.ts`. Commit.

---

### Tarefa 5: guardas de obra cancelada nas actions que já existem

**Arquivos:** `app/obras/obra/[id]/_actions.ts` · testes
`app/obras/obra/[id]/__tests__/_actions.test.ts`, `app/obras/__tests__/ficha-editavel.test.ts`
(spec §5.3).

- [ ] **Teste primeiro:**

```ts
// _actions.test.ts
describe('mudarEtapaAction — cancelada não entra nem sai pelo seletor', () => {
  it('destino "cancelado" é recusado como etapa inválida', async () => {
    expect(await mudarEtapaAction('o1', 'cancelado')).toEqual({ error: 'Etapa inválida' })
    expect(updateMock).not.toHaveBeenCalled()
  })
  it('origem "cancelado" é recusada antes de qualquer escrita', async () => {
    obraAtual = obra({ etapa: 'cancelado', cancelado_etapa_anterior: 'andamento' })
    expect(await mudarEtapaAction('o1', 'andamento')).toEqual({ error: 'Obra cancelada não muda de etapa. Use "Desfazer cancelamento".' })
    expect(updateMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
it('corrigirDataFechamentoAction recusa obra cancelada (comportamento de hoje, agora explícito)', async () => { /* ... */ })

// ficha-editavel.test.ts — mesmo mock de supabase do arquivo, obra lida com etapa 'cancelado'
it.each([
  ['salvarAutorizacaoAction', () => salvarAutorizacaoAction('o1', AUT_VAZIA)],
  ['salvarIdentificacaoAction', () => salvarIdentificacaoAction('o1', /* dados válidos do arquivo */)],
  ['salvarCronogramaAction', () => salvarCronogramaAction('o1', /* dados válidos do arquivo */)],
])('%s recusa obra cancelada, sem chamar a RPC', async (_n, chamar) => {
  expect(await chamar()).toEqual({ error: 'Obra cancelada é só leitura. Desfaça o cancelamento para editar.' })
  expect(rpcMock).not.toHaveBeenCalled()
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_actions.test" app/obras/__tests__/ficha-editavel.test.ts`
  (o teste de destino já passa hoje — é trava de regressão; os outros falham.)
- [ ] **Implementar:** uma linha `if (cancelada(obra)) return { error: … }` logo depois do `lerObra`
  em `mudarEtapaAction`, nos três `salvar*` e em `corrigirDataFechamentoAction` (antes do cast para
  `EtapaCiclo`). As duas mensagens como `const` locais.
- [ ] Ver passar (todos os antigos dos dois arquivos também). Commit.

---

### Tarefa 6: Base — filtro, opções, indicadores

**Arquivos:** `app/obras/base/_regras.ts` · teste `app/obras/__tests__/base.test.ts` (spec §7.1).

- [ ] **Teste primeiro** — no `describe('filtrar — Etapa da obra')` e no `describe('kpisDaBase')`,
  com uma base de fixture que tenha 1 obra ativa de cada etapa relevante + 2 canceladas (uma pelo
  cliente vinda de `andamento` com `aprovacao` há 90 dias, uma pela Manfac vinda de `definir`):

```ts
it('"Todas" esconde as canceladas', () => { /* nenhuma com etapa 'cancelado' no resultado */ })
it('"cancelado", "cancelado:cliente", "cancelado:manfac"', () => { /* 2, 1, 1 */ })
it('"Executadas, ainda na esteira" e "fase:*" não trazem cancelada', () => { /* ... */ })
it('canceladasFora respeita os outros filtros', () => {
  expect(canceladasFora(base, FILTROS_PADRAO)).toBe(2)
  expect(canceladasFora(base, { ...FILTROS_PADRAO, pcm: 'YURI' })).toBe(/* só as do YURI */)
})
it('opcoesEtapa termina com o grupo Canceladas', () => {
  expect(opcoesEtapa().grupos.at(-1)).toEqual({ fase: 'Canceladas', opcoes: [
    { v: 'cancelado', t: 'Todas as canceladas' },
    { v: 'cancelado:cliente', t: 'Canceladas pelo Cliente' },
    { v: 'cancelado:manfac', t: 'Canceladas pela Manfac' },
  ] })
})
it('nenhum indicador conta cancelada', () => {
  // kpisDaBase(base) === kpisDaBase(base sem as canceladas), indicador por indicador —
  // inclui "aprovadas há mais de 60 dias", o único que hoje a contaria.
})
it('ordenar por etapa usa o nome de tela ("Cancelada")', () => { /* ... */ })
```

- [ ] Ver falhar: `npx jest app/obras/__tests__/base.test.ts`
- [ ] **Implementar** spec §7.1: `filtrar`, `opcoesEtapa`, `velhas` com `!encerrada(o)`, `export
  function canceladasFora(obras, filtros)`. `COR_ETAPA`/`ordenar` já vieram da T1.
- [ ] Ver passar. Commit.

---

### Tarefa 7: pílula "Cancelada · Cliente/Manfac"

**Arquivos:** `app/obras/base/_etiquetas.tsx:28-30` · teste `app/obras/__tests__/etiquetas.test.tsx`
(spec §7.2).

- [ ] **Teste primeiro:**

```tsx
test('EtiquetaEtapa: cancelada mostra quem cancelou', () => {
  render(<EtiquetaEtapa obra={{ etapa: 'cancelado', cancelado_por: 'manfac' }} />)
  expect(screen.getByText('Cancelada · Manfac')).toBeInTheDocument()
})
test('EtiquetaEtapa: etapa comum continua com o nome da etapa', () => { /* 'Em andamento' */ })
```

- [ ] Ver falhar: `npx jest app/obras/__tests__/etiquetas.test.tsx`
- [ ] **Implementar:** `Pick<Obra, 'etapa' | 'cancelado_por'>`; cancelada → `Cancelada · Cliente` /
  `Cancelada · Manfac` na cor `COR_ETAPA.cancelado`.
- [ ] Ver passar. Commit.

---

### Tarefa 8: Tarefas — esconder tarefa aberta de obra cancelada (área do Duda)

**Arquivos:** `app/obras/tarefas/page.tsx` · teste `app/obras/tarefas/__tests__/page.test.tsx` (novo)
(spec §8 e §11). **Só duas mudanças no arquivo**: `etapa` no `select` de `:55-57` e o filtro com
`tarefaVisivelNaLista` antes do `<Lista>`. Nada mais.

- [ ] **Teste primeiro** — mockar `@/lib/supabase/server`, `@/lib/auth/systemAccess`,
  `@/lib/auth/roles` e `../_lista` (capturar as props), no padrão de
  `app/obras/obra/[id]/__tests__/page.test.tsx`:

```tsx
test('tarefa aberta de obra cancelada não chega à lista; respondida e de obra ativa chegam', async () => {
  // obras_tarefa: t1 aberta (obra A cancelado), t2 respondida (obra A), t3 aberta (obra B andamento)
  // obras_obra: A etapa 'cancelado', B etapa 'andamento'
  render(await TarefasPage())
  expect(listaProps.tarefas.map((t) => t.id)).toEqual(['t2', 't3'])
})
test('o select de obras traz a etapa', async () => { /* select chamado com 'id, os, loja, equipe, pcm, etapa' */ })
```

- [ ] Ver falhar: `npx jest app/obras/tarefas/__tests__/page`
- [ ] **Implementar** as duas mudanças.
- [ ] Ver passar. Commit com a mensagem citando "aviso ao Duda: spec-cancelamento §11".

---

### Tarefa 9: a faixa e a janela de cancelar

**Arquivos:** `app/obras/obra/[id]/_cancelar-obra.tsx` (novo) · teste
`app/obras/obra/[id]/__tests__/_cancelar-obra.test.tsx` (novo) (spec §6.1). Textos **literais** da
spec/mockup.

- [ ] **Teste primeiro** (`cancelar = jest.fn()` por prop; o `<dialog>` roda pelo caminho de reserva
  de `_ui/dialogo.tsx` — testar o comportamento, não a API nativa):

```tsx
const props = { obraId: 'o1', loja: 'DP ITABORAI', os: '0926-011480', etapaNome: 'Em andamento', responsavel: 'YURI' }
test('variante ficha: título "Encerrar sem executar" e o botão', () => { /* ... */ })
test('variante triagem: título "Esta OS não vai virar obra?"', () => { /* ... */ })
test('confirmar fica desabilitado até escolher quem cancelou, com a dica', async () => {
  // abrir → botão "Cancelar obra" do diálogo disabled + "Escolha quem cancelou para continuar."
  // escolher "Cancelado pela Manfac" → habilita e a dica some
})
test('o aviso diz para onde a obra volta', async () => { /* 'Dá para desfazer na própria ficha, e ela volta para "Em andamento".' */ })
test('envia por e observação; mostra "Cancelando…" enquanto espera', async () => {
  // cancelar resolve depois; clicar confirmar → cancelar('o1', { por: 'manfac', obs: 'duplicada' })
  // botão da faixa: "Cancelando…" e disabled
})
test('erro: mensagem do servidor + "Tentar de novo" reenvia a mesma escolha', async () => {
  // 1ª chamada { error: 'Não deu para cancelar a obra. Nada mudou — tente de novo.' }
  // clicar "Tentar de novo" → 2ª chamada com os MESMOS argumentos
})
test('"Voltar sem cancelar" fecha sem chamar a action', async () => { /* ... */ })
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_cancelar-obra"`
- [ ] **Implementar** com `Dialogo` de `_ui/dialogo.tsx` (botões: ghost "Voltar sem cancelar",
  "Cancelar obra" com `desabilitado: !escolha`); estado da escolha e da observação no componente da
  faixa (é o que o "Tentar de novo" reenvia); `useTransition` para o pendente. Tipo da prop
  `cancelar` declarado **neste** arquivo.
- [ ] Ver passar. Commit.

---

### Tarefa 10: o selo da obra cancelada e o desfazer

**Arquivos:** `app/obras/obra/[id]/_cancelamento.tsx` (novo) · teste
`app/obras/obra/[id]/__tests__/_cancelamento.test.tsx` (novo) (spec §6.3).

- [ ] **Teste primeiro** (`desfazer = jest.fn()` por prop):

```tsx
const base = { obraId: 'o1', loja: 'DP ITABORAI', os: '0926-011480', por: 'cliente' as const,
  obs: 'Loja informou que a reforma foi suspensa pela regional.', em: '2026-09-23T13:42:00Z',
  quem: 'rafael.souza@manfac.com.br', etapaAnterior: 'andamento' as const, responsavel: 'YURI' }
test('selo: quem, quando (fuso de SP), por quem, onde estava e a observação', () => {
  // 'Cancelado pelo Cliente'; 'em 23/09/2026 às 10:42 por rafael.souza@manfac.com.br · estava em Em andamento'; a obs entre aspas
})
test('sem observação, não desenha aspas vazias', () => { /* ... */ })
test('desfazer pede confirmação com o texto da etapa de campo', async () => {
  // 'A obra volta para Em andamento, entra de novo no diário de YURI e as tarefas abertas dela voltam a cobrar.'
})
test('vinda da triagem: o texto diz que abre de novo na Triagem', async () => { /* etapaAnterior 'definir' */ })
test('"Manter cancelada" fecha sem chamar a action', async () => { /* ... */ })
test('confirmar chama desfazer("o1"), mostra "Desfazendo…" e, no erro, a mensagem', async () => { /* ... */ })
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_cancelamento"`
- [ ] **Implementar** com `Dialogo`; data/hora com `Intl.DateTimeFormat` no `FUSO` de `tipos.ts`,
  montada como `DD/MM/AAAA às HH:MM`.
- [ ] Ver passar. Commit.

---

### Tarefa 11: aviso "N obras canceladas fora desta lista"

**Arquivos:** `app/obras/base/_visao.tsx` · teste `app/obras/base/__tests__/_visao.test.tsx` (novo)
(spec §7.3).

- [ ] **Teste primeiro:**

```tsx
test('em "Todas", avisa quantas canceladas ficaram fora, e "ver canceladas" troca o filtro', async () => {
  // obras: 3 ativas + 2 canceladas → tabela com 3 linhas; '2 obras canceladas fora desta lista'
  // clicar 'ver canceladas' → tabela com as 2; texto 'Canceladas não contam dias, não aparecem no Kanban…'
})
test('singular com 1 cancelada; nada quando não há cancelada', () => { /* '1 obra cancelada fora desta lista' */ })
```

- [ ] Ver falhar: `npx jest app/obras/base/__tests__/_visao`
- [ ] **Implementar** com `canceladasFora` (T6), abaixo da visão escolhida.
- [ ] Ver passar. Commit.

---

### Tarefa 12: faixa de cancelar na Triagem

**Arquivos:** `app/obras/obra/[id]/_triagem.tsx` · teste
`app/obras/obra/[id]/__tests__/_triagem-cancelar.test.tsx` (novo) (spec §6.2).

- [ ] **Teste primeiro** (mockar `../_actions` como os testes de triagem já fazem; montar a obra como
  `_triagem-equipe.test.tsx`):

```tsx
test('a Triagem tem a faixa "Esta OS não vai virar obra?" e cancela com cancelarObraAction', async () => {
  // abrir, escolher "Cancelado pela Manfac", confirmar → cancelarObraAction('o1', { por: 'manfac', obs: '' })
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_triagem-cancelar"`
- [ ] **Implementar:** importar `cancelarObraAction` junto das outras (`:52`) e renderizar
  `<FaixaCancelar variante="triagem" …/>` depois do bloco de liberar (`:557`).
- [ ] Ver passar, e `npx jest "app/obras/obra/.id./__tests__/_triagem-equipe"`. Commit.

---

### Tarefa 13: ligar tudo na ficha

**Arquivos:** `app/obras/obra/[id]/_ficha.tsx` · testes `app/obras/obra/[id]/__tests__/_ficha.test.tsx`,
`app/obras/obra/[id]/__tests__/page.test.tsx` (spec §6.2, §6.3).

- [ ] **Teste primeiro:**

```tsx
// _ficha.test.tsx — mesmo renderFicha do arquivo
describe('Cancelamento na ficha', () => {
  test.each(['levantamento', 'andamento', 'paralisado'])('%s: faixa "Encerrar sem executar" no Ciclo de vida', () => {})
  test.each(['relatorio', 'fecharOS', 'faturado'])('%s: sem botão, com a linha "já foi executada em campo"', () => {
    // e SEM a frase das Pendências (spec §10, divergência 2)
  })
  test('cancelada: selo, sem seletor de etapa, sem faixa, sem Editar nos três blocos', () => {})
  test('cancelada: sem caixa "Sem OS aprovada" nem caixa de alerta', () => {})
  test('cancelada: esteira com "cancelada aqui" e os passos "não se aplica"', () => {})
  test('cancelada vinda da triagem: passo zero "Triagem" com "Nunca foi liberada para o diário"', () => {})
  test('cancelada: a frase "Obra cancelada não muda de etapa…"', () => {})
})

// page.test.tsx
test('obra cancelada que veio da triagem abre a FICHA, não a Triagem', async () => {
  // etapa 'cancelado', cancelado_etapa_anterior 'definir' → renderiza Ficha (mock) e não Triagem
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_ficha" "app/obras/obra/.id./__tests__/page"`
  (o de `page` já passa hoje — trava de regressão.)
- [ ] **Implementar** spec §6.2/§6.3: `cancelada(obra)` decide o modo; `SeloCancelada` com
  `desfazer={desfazerCancelamentoAction}`; `FaixaCancelar` com `cancelar={cancelarObraAction}`;
  `somenteLeitura={cancelada(obra)}` nos três blocos; `&& !cancelada(obra)` na caixa "Sem OS
  aprovada" (`:555`); `Esteira` com prop `cancelada` (selo "cancelada aqui" no `Passo`, passos
  `pulado`/"não se aplica"); legenda do seletor com a frase do mockup quando a faixa aparece.
- [ ] Ver passar (os antigos do arquivo também). Commit.

---

### Tarefa 14: dívidas + verificação final

**Arquivos:** `docs/DIVIDAS.md`

- [ ] Acrescentar à seção (A) as **6 linhas** da spec §9, no formato do arquivo (o que é, âncora
  `arquivo:linha` **já com as linhas do código novo**, data 23/09/2026, motivo, consequência), mais
  qualquer borda anotada pelas tarefas.
- [ ] `npm test` — as 7 suítes do `manfac-site/` falham por resolução de módulo e não contam
  (AGENTS.md). Zero falha nova no hub.
- [ ] `npx tsc --noEmit`, `npm run lint` e `npm run build` limpos (ruído de lint fora de `app/` vindo de
  worktree é a dívida B9 — conferir que nada vem de arquivo tocado aqui).
- [ ] **Pré-requisito do teste manual — decisão do João:** migration aplicada (PASSO 0 → PARTE 1 →
  PARTE 2 com 11/11 `OK` → PARTE 3 com `RESUMO: 11/11 OK`) e a tabela de `.claude/rules/sql.md`
  atualizada no mesmo commit da aplicação.
- [ ] **Teste manual** em `npm run dev`, numa obra de teste: (1) obra em Andamento → faixa, janela,
  confirmar desabilitado sem escolha, cancelar pelo Cliente com observação → ficha cancelada com selo,
  sem Editar, sem seletor, linha no Histórico (filtro "Cancelamento"); (2) a obra sumiu do diário do
  responsável e as tarefas abertas dela sumiram de Tarefas; (3) Base: some de "Todas", aviso "1 obra
  cancelada…", aparece em "Canceladas pelo Cliente", "Dias em aberto" "—", fora do Kanban, KPIs
  iguais a antes menos ela; (4) desfazer → volta a Andamento com o mesmo "há N dias", tarefas e
  diário de volta, segunda linha no Histórico; (5) obra em Aguardando definição → cancelar pela Manfac
  na Triagem → abre a ficha cancelada; desfazer → volta à Triagem; (6) obra em Relatório de entrega →
  sem botão, com a linha de explicação. **No celular** (~375px): janela legível e rádios tocáveis.
- [ ] Commit. **Não pushar** — o deploy é decisão do João, e **só depois** da migration.

---

## Autoconferência contra a spec

| Spec | Tarefa |
|---|---|
| §3 migration (escrita, não aplicada) | já entregue; aplicação: pré-requisito da T14 |
| §4 tipos, catálogo, `faseDe`/`encerrada`/`derivar`… | T1 |
| §5.1, §5.2 cancelar e desfazer, atômicos, com histórico | T4 |
| §5.3 guardas em `mudarEtapaAction` e nos blocos | T5 |
| §6.1 faixa e janela | T9 |
| §6.2 onde a faixa aparece | T12 (triagem), T13 (ficha) |
| §6.3 ficha cancelada, selo, desfazer | T10, T13 |
| §6.4 histórico | T2 |
| §6.5 blocos só leitura | T3 |
| §7.1 filtro, opções, KPIs | T6 |
| §7.2 pílula | T7 |
| §7.3 aviso | T11 |
| §8, §11 tarefas (Duda) | T8 |
| §9 dívidas | T14 |
| §10 divergências (texto sem Pendências; estados na faixa) | T9, T13 |
