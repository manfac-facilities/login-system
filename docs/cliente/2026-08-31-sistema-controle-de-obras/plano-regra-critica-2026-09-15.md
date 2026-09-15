# Contagem de atenção / crítica — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A obra passa a contar os dias da data mais antiga entre liberação e aprovação (ou da entrada), vira atenção acima de 20 e crítica acima de 30, e (decisão 12) só encerra quando a Manfac fatura.

**Architecture:** Toda a regra continua em funções puras de `app/obras/_lib/tipos.ts`. `derivar()` ganha dois derivados novos (`ancora`, `diasAlerta`), e `critico`/`classeDias` passam a lê-los. O derivado `dias` (desde a aprovação) não muda. Em `base/`, só apresentação: o rótulo da âncora, a coluna e a ordem da tabela, e o `BadgeDias`.

**Tech Stack:** Next.js (App Router), TypeScript, Jest 30 + @testing-library/react (jsdom).

**Spec:** `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-regra-critica-2026-09-15.md`

## Global Constraints

- **ATENÇÃO, perímetro:** o combinado é código só em `app/obras/base/` e testes. As Tasks 1, 2 e 5 editam `app/obras/_lib/tipos.ts`, que está **fora** desse perímetro (spec, C2). **Não comece essas tasks sem o OK explícito do coordenador.**
- **Não tocar:** `app/obras/obra/[id]/_actions.ts`, `_triagem.tsx`, `_ficha.tsx` (outra frente mexe em paralelo), `app/obras/diario/*`, `app/obras/_ui/*`.
- Nenhuma migration. Nenhuma escrita no banco. Derivado nunca é gravado (`tipos.ts:14-18`: snake_case = coluna, camelCase = derivado).
- Limiares com `>` estrito: atenção `> 20`, crítica `> 30`.
- Âncora: `'aprovacao' | 'liberacao' | 'entrada'`. A liberação só vale com `liberado_por` preenchido. Em empate, aprovação. A entrada é `created_at` convertido para o dia em `America/Sao_Paulo`.
- Todo teste passa `hoje` explícito. Os testes novos usam `'2026-09-14'`.
- Textos na UI: "dias desde a aprovação", "dias desde a liberação", "dias desde a entrada"; singular "dia". Coluna: "Dias em aberto" (provisório, spec A5).
- Comando de teste: `npm test -- <caminho>`. Nesta máquina uma suíte leva cerca de 30 a 60 s.
- Baseline em 15/09: `tipos.test.ts` + `base.test.ts` = 87 testes passando; `npx tsc --noEmit -p .` sem erros.

## Mapa de arquivos

| Arquivo | Responsabilidade | Tasks |
|---|---|---|
| `app/obras/_lib/tipos.ts` | `dataSP`, `ancoraDias`, limiares, derivados, `critico`, `classeDias`, `encerrada` | 1, 2, 5 |
| `app/obras/__tests__/tipos.test.ts` | Testes da regra | 1, 2, 5 |
| `app/obras/base/_regras.ts` | `ROTULO_ANCORA`, `sufixoDias`, `COLS`, `ORDEM_PADRAO` | 3 |
| `app/obras/__tests__/base.test.ts` | Testes de `_regras` e do filtro da esteira | 3, 5 |
| `app/obras/base/_etiquetas.tsx` | `BadgeDias` | 4 |
| `app/obras/__tests__/etiquetas.test.tsx` (novo) | Teste de render do `BadgeDias` | 4 |

---

### Task 1: Âncora da contagem (`dataSP`, `ancoraDias`, limiares)

**Fora do perímetro: exige OK do coordenador.**

**Files:**
- Modify: `app/obras/_lib/tipos.ts` (inserir depois de `somaDias`, por volta da linha 91, e acrescentar o bloco de limiares)
- Test: `app/obras/__tests__/tipos.test.ts`

**Interfaces:**
- Produces:
  - `export function dataSP(ts: string | null | undefined): string | null`
  - `export type AncoraDias = { de: 'aprovacao' | 'liberacao' | 'entrada'; data: string }`
  - `export function ancoraDias(o: Pick<ObraRow, 'aprovacao' | 'liberado_por' | 'liberado_em' | 'created_at'>): AncoraDias | null`
  - `export const LIMIAR_ATENCAO = 20` e `export const LIMIAR_CRITICO = 30`

- [ ] **Step 1: Escrever os testes que falham**

Em `tipos.test.ts`, acrescente `ancoraDias`, `dataSP`, `LIMIAR_ATENCAO` e `LIMIAR_CRITICO` ao `import { ... } from '../_lib/tipos'` e cole no fim do arquivo:

```ts
describe('dataSP — timestamptz vira o dia em São Paulo', () => {
  it('converte para o dia de São Paulo, não o dia UTC', () => {
    expect(dataSP('2026-09-15T01:30:00+00:00')).toBe('2026-09-14')
    expect(dataSP('2026-07-01T13:00:00Z')).toBe('2026-07-01')
    expect(dataSP('2026-08-25T02:00:00.123456+00:00')).toBe('2026-08-24')
  })

  it('vazio ou lixo não vira data', () => {
    expect(dataSP(null)).toBeNull()
    expect(dataSP('')).toBeNull()
    expect(dataSP('lixo')).toBeNull()
  })
})

describe('ancoraDias — de que data os dias contam (decisão 5 revista)', () => {
  const sem = { aprovacao: null, liberado_por: null, liberado_em: null }

  it('só aprovação: conta da aprovação', () => {
    expect(ancoraDias(obraRow({ ...sem, aprovacao: '2026-08-10' }))).toEqual({
      de: 'aprovacao',
      data: '2026-08-10',
    })
  })

  it('só liberação: conta da liberação', () => {
    expect(
      ancoraDias(obraRow({ ...sem, liberado_por: 'JUAN', liberado_em: '2026-06-02' }))
    ).toEqual({ de: 'liberacao', data: '2026-06-02' })
  })

  it('liberação antes da aprovação: vale a liberação', () => {
    expect(
      ancoraDias(
        obraRow({ aprovacao: '2026-09-01', liberado_por: 'LEANDRO', liberado_em: '2026-08-20' })
      )
    ).toEqual({ de: 'liberacao', data: '2026-08-20' })
  })

  it('aprovação antes da liberação: vale a aprovação', () => {
    expect(
      ancoraDias(
        obraRow({ aprovacao: '2026-08-10', liberado_por: 'LEANDRO', liberado_em: '2026-08-30' })
      )
    ).toEqual({ de: 'aprovacao', data: '2026-08-10' })
  })

  it('mesma data nas duas: fica com a aprovação', () => {
    expect(
      ancoraDias(
        obraRow({ aprovacao: '2026-08-10', liberado_por: 'LEANDRO', liberado_em: '2026-08-10' })
      )
    ).toEqual({ de: 'aprovacao', data: '2026-08-10' })
  })

  it('data de liberação sem o nome de quem liberou não conta', () => {
    expect(
      ancoraDias(
        obraRow({ ...sem, liberado_em: '2026-06-02', created_at: '2026-07-01T13:00:00+00:00' })
      )
    ).toEqual({ de: 'entrada', data: '2026-07-01' })
  })

  it('nome de quem liberou sem data não inventa data (spec A4)', () => {
    expect(
      ancoraDias(
        obraRow({ ...sem, liberado_por: 'JUAN', created_at: '2026-07-01T13:00:00+00:00' })
      )
    ).toEqual({ de: 'entrada', data: '2026-07-01' })
  })

  it('sem aprovação nem liberação: conta da entrada, no dia de São Paulo', () => {
    expect(ancoraDias(obraRow({ ...sem, created_at: '2026-08-25T02:00:00+00:00' }))).toEqual({
      de: 'entrada',
      data: '2026-08-24',
    })
  })

  it('sem nenhuma data utilizável não há âncora', () => {
    expect(ancoraDias(obraRow({ ...sem, created_at: '' }))).toBeNull()
  })

  it('os limiares são os do cliente: acima de 20 e acima de 30', () => {
    expect(LIMIAR_ATENCAO).toBe(20)
    expect(LIMIAR_CRITICO).toBe(30)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- app/obras/__tests__/tipos.test.ts -t "dataSP|ancoraDias"`
Expected: FAIL. `dataSP`/`ancoraDias` são `undefined` ("is not a function"), ou erro de import no TypeScript.

- [ ] **Step 3: Implementar o mínimo**

Em `app/obras/_lib/tipos.ts`, logo depois da função `somaDias` (termina por volta da linha 91):

```ts
/**
 * `timestamptz` (ex.: `created_at`) → `AAAA-MM-DD` no dia de SÃO PAULO.
 * `diasDesde` só entende `AAAA-MM-DD`: entregar o timestamp cru devolve null.
 * Pelo dia UTC, a obra sincronizada às 23h de SP cairia no dia seguinte.
 */
export function dataSP(ts: string | null | undefined): string | null {
  if (!ts) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return hojeISO(d)
}
```

Antes do bloco `// 5. Regras de leitura` (por volta da linha 429), acrescente:

```ts
// ============================================================
// 4b. Âncora da contagem de atenção / crítica
// Cliente (feedback 14, seção E): "atenção acima de 20 dias da data de aprovação
// da OS ou liberação, a que for menor. Acima de 30 dias já é crítico".
// Decisão 5 revista (14/09): a data MAIS ANTIGA entre liberação e aprovação;
// sem nenhuma das duas, a entrada. Mudar isto é mudar o produto.
// ============================================================

export const LIMIAR_ATENCAO = 20
export const LIMIAR_CRITICO = 30

export type AncoraDias = { de: 'aprovacao' | 'liberacao' | 'entrada'; data: string }

export function ancoraDias(
  o: Pick<ObraRow, 'aprovacao' | 'liberado_por' | 'liberado_em' | 'created_at'>
): AncoraDias | null {
  const aprov = msDe(o.aprovacao) !== null ? (o.aprovacao as string) : null
  // Sem nome de quem liberou, a data da liberação não significa nada — a mesma
  // regra que a action de liberar aplica ao gravar.
  const lib = o.liberado_por && msDe(o.liberado_em) !== null ? (o.liberado_em as string) : null
  if (aprov && lib) {
    return lib < aprov ? { de: 'liberacao', data: lib } : { de: 'aprovacao', data: aprov }
  }
  if (aprov) return { de: 'aprovacao', data: aprov }
  if (lib) return { de: 'liberacao', data: lib }
  const entrada = dataSP(o.created_at)
  return entrada ? { de: 'entrada', data: entrada } : null
}
```

(`msDe` é privada do mesmo arquivo e já está definida acima; pode ser usada aqui.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- app/obras/__tests__/tipos.test.ts`
Expected: PASS em todos, incluindo os 87 anteriores somados a `base`. Nesta suíte, nenhum teste antigo pode quebrar.

- [ ] **Step 5: Commit**

```bash
git add app/obras/_lib/tipos.ts app/obras/__tests__/tipos.test.ts
git commit -m "feat(obras): ancora da contagem de atencao e critica"
```

---

### Task 2: Derivados novos e limiares 20/30 em `critico` e `classeDias`

**Fora do perímetro: exige OK do coordenador.**

**Files:**
- Modify: `app/obras/_lib/tipos.ts` — `Derivados` (:329-344), `derivar` (:400-427), comentário do cabeçalho (:11-12), comentário da escala (:429-437), `critico` (:439-442), `classeDias` (:549-555)
- Test: `app/obras/__tests__/tipos.test.ts` — substituir os describes `crítico — o vermelho, reservado a uma coisa só` (:233-247) e `contador de dias`

**Interfaces:**
- Consumes: `ancoraDias`, `AncoraDias`, `LIMIAR_ATENCAO`, `LIMIAR_CRITICO` (Task 1)
- Produces: `Obra` ganha `ancora: AncoraDias | null` e `diasAlerta: number | null`. `critico(o)` e `classeDias(o)` mantêm a assinatura.

- [ ] **Step 1: Trocar os testes da regra antiga pelos da nova**

Em `tipos.test.ts`, **apague** o describe inteiro `describe('crítico — o vermelho, reservado a uma coisa só', ...)` e o describe inteiro `describe('contador de dias', ...)`, e cole no lugar:

```ts
describe('crítico — acima de 30 dias contados da âncora', () => {
  const H = '2026-09-14'
  const sem = { aprovacao: null, liberado_por: null, liberado_em: null, duracao: null }

  it('30 dias ainda não é crítica; 31 é', () => {
    expect(critico(obra({ ...sem, aprovacao: '2026-08-15' }, H))).toBe(false) // 30
    expect(critico(obra({ ...sem, aprovacao: '2026-08-14' }, H))).toBe(true) // 31
  })

  it('liberada há 104 dias e aprovada hoje: continua crítica em 104', () => {
    const o = obra(
      { ...sem, liberado_por: 'JUAN', liberado_em: '2026-06-02', aprovacao: '2026-09-14' },
      H
    )
    expect(o.ancora).toEqual({ de: 'liberacao', data: '2026-06-02' })
    expect(o.diasAlerta).toBe(104)
    expect(critico(o)).toBe(true)
    // `dias` continua sendo desde a aprovação — não mudou de significado.
    expect(o.dias).toBe(0)
  })

  it('aprovação anterior à liberação: conta da aprovação', () => {
    const o = obra(
      { ...sem, aprovacao: '2026-08-10', liberado_por: 'LEANDRO', liberado_em: '2026-08-30' },
      H
    )
    expect(o.diasAlerta).toBe(35)
    expect(critico(o)).toBe(true)
  })

  it('aprovação posterior à liberação: conta da liberação, e 25 dias é atenção', () => {
    const o = obra(
      { ...sem, aprovacao: '2026-09-01', liberado_por: 'LEANDRO', liberado_em: '2026-08-20' },
      H
    )
    expect(o.diasAlerta).toBe(25)
    expect(critico(o)).toBe(false)
    expect(classeDias(o)).toBe('atencao')
  })

  it('sem aprovação nem liberação: conta da entrada', () => {
    const o = obra({ ...sem, created_at: '2026-07-01T13:00:00+00:00' }, H)
    expect(o.ancora).toEqual({ de: 'entrada', data: '2026-07-01' })
    expect(o.diasAlerta).toBe(75)
    expect(critico(o)).toBe(true)
  })

  it('resíduo registrado (spec C1): liberação lançada hoje derruba a contagem da entrada', () => {
    const o = obra(
      {
        ...sem,
        liberado_por: 'JUAN',
        liberado_em: '2026-09-14',
        created_at: '2026-07-01T13:00:00+00:00',
      },
      H
    )
    expect(o.diasAlerta).toBe(0)
    expect(critico(o)).toBe(false)
  })

  it('sem âncora não há contagem nem crítica', () => {
    const o = obra({ ...sem, created_at: '' }, H)
    expect(o.diasAlerta).toBeNull()
    expect(critico(o)).toBe(false)
  })

  it('aguardando definição nunca é crítica, mesmo contando da entrada', () => {
    const o = obra({ ...sem, etapa: 'definir', created_at: '2026-07-01T13:00:00+00:00' }, H)
    expect(o.diasAlerta).toBe(75)
    expect(critico(o)).toBe(false)
  })

  it('obra encerrada nunca é crítica', () => {
    expect(critico(obra({ ...sem, aprovacao: '2026-01-01', etapa: 'faturado' }, H))).toBe(false)
  })

  it('pós-campo também vira crítica acima de 30', () => {
    const o = obra(
      { ...sem, aprovacao: '2026-08-01', etapa: 'fecharOS', desde_etapa: '2026-09-10' },
      H
    )
    expect(o.diasAlerta).toBe(44)
    expect(critico(o)).toBe(true)
  })
})

describe('contador de dias — atenção acima de 20, crítica acima de 30', () => {
  const H = '2026-09-14'
  // duracao null: com 7 (o padrão da fixture), estourou() pintaria âmbar
  // a partir de 29 dias e mascararia a fronteira.
  const sem = { aprovacao: null, liberado_por: null, liberado_em: null, duracao: null }

  it('20 não pinta; 21 e 30 são atenção; 31 é crítica', () => {
    expect(classeDias(obra({ ...sem, aprovacao: '2026-08-25' }, H))).toBe('') // 20
    expect(classeDias(obra({ ...sem, aprovacao: '2026-08-24' }, H))).toBe('atencao') // 21
    expect(classeDias(obra({ ...sem, aprovacao: '2026-08-15' }, H))).toBe('atencao') // 30
    expect(classeDias(obra({ ...sem, aprovacao: '2026-08-14' }, H))).toBe('critico') // 31
  })

  it('estourou continua pintando de âmbar com poucos dias', () => {
    // duracao 3 → estoura acima de 12 dias desde a aprovação; 13 dias < 20
    expect(classeDias(obra({ ...sem, aprovacao: '2026-09-01', duracao: 3 }, H))).toBe('atencao')
  })

  it('não pinta obra encerrada nem obra aguardando definição', () => {
    expect(classeDias(obra({ aprovacao: '2026-01-01', etapa: 'faturado' }))).toBe('')
    expect(classeDias(obra({ aprovacao: '2026-01-01', etapa: 'definir' }))).toBe('')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- app/obras/__tests__/tipos.test.ts -t "crítico|contador de dias"`
Expected: FAIL. `o.ancora`/`o.diasAlerta` saem `undefined`, e `critico` de 31 dias devolve `false`.

- [ ] **Step 3: Implementar**

Em `Derivados` (`tipos.ts:329-344`), depois do campo `dias`:

```ts
  /** De que data a contagem de atenção/crítica corre. Ver `ancoraDias`. */
  ancora: AncoraDias | null
  /** Dias desde a âncora. É o número do selo, da coluna e de `critico`/`classeDias`. */
  diasAlerta: number | null
```

Troque o comentário de `dias` (:330) por:

```ts
  /** Dias desde a APROVAÇÃO. Alimenta `estourou` e o KPI de 60 dias — NÃO a crítica. */
```

`AncoraDias` é declarado na Task 1, mais abaixo no arquivo. Tipos em TypeScript são içados, então não há erro de ordem.

Em `derivar` (:400), depois de `const dias = diasDesde(o.aprovacao, hoje)`:

```ts
  const ancora = ancoraDias(o)
  const diasAlerta = ancora ? diasDesde(ancora.data, hoje) : null
```

e no objeto devolvido, depois de `dias,`:

```ts
    ancora,
    diasAlerta,
```

Substitua `critico` (:439-442):

```ts
/** Crítica: em aberto há mais de 30 dias desde a âncora (feedback 14, seção E). */
export function critico(o: Obra): boolean {
  return (
    !encerrada(o) &&
    o.etapa !== 'definir' &&
    o.diasAlerta !== null &&
    o.diasAlerta > LIMIAR_CRITICO
  )
}
```

Substitua a linha de `classeDias` (:553):

```ts
  if (estourou(o) || (o.diasAlerta !== null && o.diasAlerta > LIMIAR_ATENCAO)) return 'atencao'
```

Atualize os comentários que ficaram falsos. Cabeçalho (:11-12):

```ts
 * Os limiares (duracao*4, 120, 3, 15, 60) foram copiados do mockup linha a
 * linha; atenção > 20 e crítica > 30 vêm do feedback 14 (15/09/2026). Mudá-los
 * é mudar o produto aprovado — não é ajuste técnico.
```

Bloco da escala (:429-437):

```ts
// ============================================================
// 5. Regras de leitura — o que é urgente e o que não é
//
// ESCALA DE URGÊNCIA: vermelho é obra em aberto há MAIS DE 30 dias desde a
// âncora (a data mais antiga entre liberação e aprovação, ou a entrada). Até
// 14/09 o limiar era 100 dias; o cliente o baixou no feedback 14. Passar da
// duração, ficar travada no bloqueio ou esperar definição é âmbar.
// ============================================================
```

- [ ] **Step 4: Rodar a suíte e a checagem de tipos**

Run: `npm test -- app/obras/__tests__/tipos.test.ts`
Expected: PASS em todos.

Run: `npx tsc --noEmit -p .`
Expected: nenhuma saída. Se aparecer erro de objeto `Obra` montado à mão sem `ancora`/`diasAlerta`, acrescente os dois campos nele. Em 15/09 nenhum arquivo monta `Obra` fora de `derivar`.

- [ ] **Step 5: Commit**

```bash
git add app/obras/_lib/tipos.ts app/obras/__tests__/tipos.test.ts
git commit -m "feat(obras): atencao acima de 20 e critica acima de 30 dias desde a ancora"
```

---

### Task 3: Rótulo da âncora, coluna e ordem da tabela (`base/_regras.ts`)

**Files:**
- Modify: `app/obras/base/_regras.ts` — import (:14-25), `COLS` (:234), `ORDEM_PADRAO` (:241-242), nova seção de rótulo
- Test: `app/obras/__tests__/base.test.ts` — describe `ordenar` (:248-257) e o teste de rótulos (:307-324)

**Interfaces:**
- Consumes: `Obra.ancora`, `Obra.diasAlerta`, `AncoraDias` (Tasks 1 e 2)
- Produces:
  - `export const ROTULO_ANCORA: Record<AncoraDias['de'], string>`
  - `export function sufixoDias(o: Pick<Obra, 'diasAlerta' | 'ancora'>, curto?: boolean): string`
  - `COLS` com `{ k: 'diasAlerta', t: 'Dias em aberto', n: true }` e `ORDEM_PADRAO = { col: 'diasAlerta', dir: -1 }`

- [ ] **Step 1: Escrever os testes que falham**

Em `base.test.ts`, acrescente `sufixoDias` ao import de `'../base/_regras'`. No describe `ordenar`, troque o primeiro teste por:

```ts
  it('o default é a contagem de alerta decrescente', () => {
    expect(ORDEM_PADRAO).toEqual({ col: 'diasAlerta', dir: -1 })
    const base = [
      obra({ aprovacao: '2026-08-29' }),
      obra({ aprovacao: '2026-06-01' }),
      obra({ aprovacao: '2026-08-15' }),
    ]
    expect(ordenar(base, ORDEM_PADRAO).map((o) => o.diasAlerta)).toEqual([91, 16, 2])
  })

  it('ordena pela âncora, não pela aprovação', () => {
    const liberadaAntes = obra({
      aprovacao: '2026-08-29',
      liberado_por: 'JUAN',
      liberado_em: '2026-06-01',
    })
    const soAprovada = obra({ aprovacao: '2026-08-15' })
    expect(ordenar([soAprovada, liberadaAntes], ORDEM_PADRAO)).toEqual([liberadaAntes, soAprovada])
  })
```

No teste `'os rótulos das colunas são os aprovados no mockup'`, troque `'Dias desde a aprovação',` por `'Dias em aberto',`.

Cole no fim do arquivo:

```ts
describe('sufixoDias — o selo diz de onde está contando', () => {
  it('forma longa nomeia a âncora', () => {
    expect(sufixoDias({ diasAlerta: 104, ancora: { de: 'liberacao', data: '2026-06-02' } })).toBe(
      'dias desde a liberação'
    )
    expect(sufixoDias({ diasAlerta: 109, ancora: { de: 'aprovacao', data: '2026-05-28' } })).toBe(
      'dias desde a aprovação'
    )
    expect(sufixoDias({ diasAlerta: 75, ancora: { de: 'entrada', data: '2026-07-01' } })).toBe(
      'dias desde a entrada'
    )
  })

  it('singular com 1 dia', () => {
    expect(sufixoDias({ diasAlerta: 1, ancora: { de: 'entrada', data: '2026-08-30' } })).toBe(
      'dia desde a entrada'
    )
  })

  it('forma curta e obra sem âncora dizem só a unidade', () => {
    expect(
      sufixoDias({ diasAlerta: 104, ancora: { de: 'liberacao', data: '2026-06-02' } }, true)
    ).toBe('dias')
    expect(sufixoDias({ diasAlerta: null, ancora: null })).toBe('dias')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- app/obras/__tests__/base.test.ts`
Expected: FAIL. `sufixoDias` não existe, `ORDEM_PADRAO.col` é `'dias'` e o rótulo antigo não bate.

- [ ] **Step 3: Implementar**

Em `_regras.ts`, acrescente `type AncoraDias` ao import de `'../_lib/tipos'`:

```ts
import {
  CICLO,
  ETAPAS,
  encerrada,
  faseDe,
  liberada,
  posCampo,
  semCobertura,
  type AncoraDias,
  type Etapa,
  type Fase,
  type Obra,
} from '../_lib/tipos'
```

Em `COLS`, troque a linha `{ k: 'dias', t: 'Dias desde a aprovação', n: true },` por:

```ts
  // Rótulo provisório (spec A5): "desde a aprovação" ficou falso quando a
  // contagem passou a correr da âncora. Aguarda o texto aprovado.
  { k: 'diasAlerta', t: 'Dias em aberto', n: true },
```

Troque `ORDEM_PADRAO` e o comentário acima dele:

```ts
/** O default: mais dias desde a âncora primeiro — as críticas no topo. */
export const ORDEM_PADRAO: Ordem = { col: 'diasAlerta', dir: -1 }
```

Antes da seção `/* Indicadores */`, acrescente:

```ts
/* -------------------------------------------------------------------------- */
/* Selo de dias                                                               */
/* -------------------------------------------------------------------------- */

/** Como a âncora aparece no selo (mockup J4 v01, seção E, :270). */
export const ROTULO_ANCORA: Record<AncoraDias['de'], string> = {
  aprovacao: 'aprovação',
  liberacao: 'liberação',
  entrada: 'entrada',
}

/** "dias desde a liberação" / "dia desde a entrada" / "dias" (curto ou sem âncora). */
export function sufixoDias(o: Pick<Obra, 'diasAlerta' | 'ancora'>, curto = false): string {
  const unidade = o.diasAlerta === 1 ? 'dia' : 'dias'
  if (curto || !o.ancora) return unidade
  return `${unidade} desde a ${ROTULO_ANCORA[o.ancora.de]}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- app/obras/__tests__/base.test.ts`
Expected: PASS em todos.

- [ ] **Step 5: Commit**

```bash
git add app/obras/base/_regras.ts app/obras/__tests__/base.test.ts
git commit -m "feat(obras): tabela ordena e rotula pela contagem desde a ancora"
```

---

### Task 4: `BadgeDias` mostra a contagem e a âncora

**Files:**
- Modify: `app/obras/base/_etiquetas.tsx:25` (import) e `:82-93` (`BadgeDias`)
- Create: `app/obras/__tests__/etiquetas.test.tsx`

**Interfaces:**
- Consumes: `sufixoDias` (Task 3), `Obra.diasAlerta`, `classeDias` (Task 2)
- Produces: `BadgeDias({ obra, curto })` com a mesma assinatura. Quem já usa (`_table.tsx`, `_kanban.tsx`, `_ficha.tsx`, `_triagem.tsx`) não precisa mudar.

- [ ] **Step 1: Escrever o teste que falha**

Crie `app/obras/__tests__/etiquetas.test.tsx`:

```tsx
/**
 * Render do selo de dias. `hoje` fixo em 2026-09-14 (exemplos do mockup J4 v01).
 */
import { render, screen } from '@testing-library/react'
import { derivar, type ObraRow } from '../_lib/tipos'
import { BadgeDias } from '../base/_etiquetas'

const H = '2026-09-14'

function linha(over: Partial<ObraRow> = {}): ObraRow {
  return {
    id: 'o1',
    os: '0526-008102',
    loja: 'DP TESTE',
    descricao: null,
    tipo: null,
    valor: null,
    origem: null,
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: null,
    pcm: 'LUANA',
    equipe: 'MANFAC-7',
    os_aprovada: false,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento',
    bloqueio: 'Sem bloqueio',
    mau_uso: false,
    prioridade: null,
    aprovacao: null,
    inicio_plan: null,
    inicio_real: null,
    duracao: null,
    fim_real: null,
    desde_etapa: null,
    marco_exec_fim: null,
    marco_relatorio: null,
    marco_os_aprov: null,
    marco_fechou_os: null,
    marco_liberou_fat: null,
    marco_faturou: null,
    pendencia: null,
    pend_resp: null,
    pend_prazo: null,
    prox_acao: null,
    atualizacao: null,
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-05-29T12:00:00+00:00',
    updated_at: null,
    ...over,
  }
}

describe('BadgeDias', () => {
  it('liberada há 104 dias e aprovada hoje: 104, vermelho, "desde a liberação"', () => {
    const o = derivar(
      linha({ liberado_por: 'JUAN', liberado_em: '2026-06-02', aprovacao: '2026-09-14' }),
      H
    )
    render(<BadgeDias obra={o} />)
    expect(screen.getByText('104')).toHaveStyle({ color: '#ff4d6d' })
    expect(screen.getByText('dias desde a liberação')).toBeInTheDocument()
  })

  it('25 dias desde a liberação: âmbar', () => {
    const o = derivar(
      linha({ liberado_por: 'LEANDRO', liberado_em: '2026-08-20', aprovacao: '2026-09-01' }),
      H
    )
    render(<BadgeDias obra={o} />)
    expect(screen.getByText('25')).toHaveStyle({ color: '#f4b73f' })
  })

  it('sem autorização conta da entrada', () => {
    const o = derivar(linha({ created_at: '2026-07-01T13:00:00+00:00' }), H)
    render(<BadgeDias obra={o} />)
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('dias desde a entrada')).toBeInTheDocument()
  })

  it('forma curta só diz "dias"', () => {
    const o = derivar(linha({ aprovacao: '2026-08-14' }), H)
    render(<BadgeDias obra={o} curto />)
    expect(screen.getByText('31')).toBeInTheDocument()
    expect(screen.getByText('dias')).toBeInTheDocument()
  })

  it('sem âncora mostra travessão', () => {
    const o = derivar(linha({ created_at: '' }), H)
    render(<BadgeDias obra={o} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- app/obras/__tests__/etiquetas.test.tsx`
Expected: FAIL. O selo ainda mostra `obra.dias` (por exemplo `0` em vez de `104`) e o texto "dias desde a aprovação".

- [ ] **Step 3: Implementar**

Em `_etiquetas.tsx`, troque o import de `'./_regras'` (:25) por:

```ts
import { COR_ETAPA, COR_PRIORIDADE, sufixoDias, temAlertaDeAusenciaField } from './_regras'
```

Substitua `BadgeDias` (:82-93):

```tsx
/**
 * `badgeDias(mockup:1896)`, com a âncora da seção E do mockup J4 v01: o número é
 * a contagem desde a âncora e o texto longo diz de onde ela corre. Vermelho só
 * para obra crítica — ver `classeDias`.
 */
export function BadgeDias({ obra, curto = false }: { obra: Obra; curto?: boolean }) {
  const classe = classeDias(obra)
  const cor = classe === 'critico' ? '#ff4d6d' : classe === 'atencao' ? '#f4b73f' : TEMA.secundario
  return (
    <span className="whitespace-nowrap text-xs font-semibold" style={{ color: cor }}>
      {obra.diasAlerta ?? '—'}{' '}
      <span className="font-normal text-[10px]">{sufixoDias(obra, curto)}</span>
    </span>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- app/obras/__tests__/etiquetas.test.tsx`
Expected: PASS em todos (5).

Se `getByText('104')` não achar o elemento porque o texto do span externo vira `"104 "`, troque por `screen.getByText('104', { exact: false })`. Não mude o componente por causa disso.

- [ ] **Step 5: Commit**

```bash
git add app/obras/base/_etiquetas.tsx app/obras/__tests__/etiquetas.test.tsx
git commit -m "feat(obras): selo de dias mostra a contagem e a ancora"
```

---

### Task 5: Decisão 12 — encerrada só quando a Manfac fatura

**Fora do perímetro: exige OK do coordenador.**
**BLOQUEADA até duas condições (spec A6, A7):**
1. O coordenador escolher **12-A** (`encerrada()` global, o que este task implementa) ou **12-B** (só os alertas; substituições no fim deste task).
2. A frente da esteira (`obra/[id]/_actions.ts`) já gravar `marco_faturou` ao concluir o passo Faturado. Hoje nada grava essa coluna; mergear antes disso faz nenhuma obra encerrar.

**Files:**
- Modify: `app/obras/_lib/tipos.ts` — `encerrada` (:360-363), `semCobertura` (:489-491)
- Test: `app/obras/__tests__/tipos.test.ts` e `app/obras/__tests__/base.test.ts`

**Interfaces:**
- Produces: `encerrada(o: Pick<ObraRow, 'marco_faturou'>): boolean`; `semCobertura(o: Pick<ObraRow, 'os_aprovada' | 'liberado_por' | 'etapa' | 'marco_faturou'>): boolean`

- [ ] **Step 1: Ajustar os testes antigos e escrever os novos (12-A)**

Em `tipos.test.ts`:

No teste `'pós-campo é fechamento ou faturamento; encerrada é só faturado'`, renomeie para `'pós-campo é fechamento ou faturamento; encerrada é ter data de faturamento'` e troque as duas linhas de `encerrada` por:

```ts
    expect(encerrada(obraRow({ etapa: 'pendFat', marco_faturou: null }))).toBe(false)
    expect(encerrada(obraRow({ etapa: 'faturado', marco_faturou: null }))).toBe(false)
    expect(encerrada(obraRow({ etapa: 'faturado', marco_faturou: '2026-09-10' }))).toBe(true)
    expect(encerrada(obraRow({ etapa: 'pendFat', marco_faturou: '2026-09-10' }))).toBe(true)
```

Em cada teste abaixo, acrescente `marco_faturou: '2026-08-30'` ao objeto que já tem `etapa: 'faturado'`:
- `'obra encerrada nunca é crítica'` (Task 2)
- `'obra em campo não encalha, e obra faturada não encalha mais'` (a linha com `etapa: 'faturado'`)
- `'obra faturada não conta mais'` (`semCobertura`)
- `'encerrada ganha de tudo'` (`sev`)
- `'não pinta obra encerrada nem obra aguardando definição'` (a linha com `etapa: 'faturado'`)

Cole no fim de `tipos.test.ts`:

```ts
describe('decisão 12 — só sai dos alertas quando a Manfac fatura', () => {
  const H = '2026-09-14'
  const liberadaHa104 = { liberado_por: 'JUAN', liberado_em: '2026-06-02', aprovacao: null }

  it('etapa Faturado sem data de faturamento continua crítica', () => {
    const o = obra({ ...liberadaHa104, etapa: 'faturado', marco_faturou: null }, H)
    expect(encerrada(o)).toBe(false)
    expect(critico(o)).toBe(true)
    expect(sev(o)).toBe('critico')
  })

  it('com data de faturamento sai de tudo, em qualquer etapa', () => {
    const o = obra({ ...liberadaHa104, etapa: 'pendFat', marco_faturou: '2026-09-10' }, H)
    expect(encerrada(o)).toBe(true)
    expect(critico(o)).toBe(false)
    expect(classeDias(o)).toBe('')
    expect(sev(o)).toBe('encerrada')
  })
})
```

Em `base.test.ts`, no describe `filtrar — Etapa da obra`, troque a fixture `obra({ etapa: 'faturado', desde_etapa: '2026-08-01' })` por `obra({ etapa: 'faturado', desde_etapa: '2026-08-01', marco_faturou: '2026-08-20' })` e acrescente ao mesmo describe:

```ts
  it('obra em Faturado sem data de faturamento continua na esteira (decisão 12)', () => {
    const semData = obra({ etapa: 'faturado', desde_etapa: '2026-08-01', marco_faturou: null })
    expect(filtrar([semData], { ...FILTROS_PADRAO, etapa: '__esteira' })).toEqual([semData])
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- app/obras/__tests__/tipos.test.ts app/obras/__tests__/base.test.ts`
Expected: FAIL nos testes novos. `encerrada(etapa faturado, marco null)` devolve `true`, e `encerrada(pendFat, marco preenchido)` devolve `false`.

- [ ] **Step 3: Implementar**

Substitua `encerrada` (`tipos.ts:360-363`):

```ts
/**
 * Fim de linha: a Manfac faturou. Decisão 12 (14/09/2026): a obra só sai dos
 * alertas quando a data de faturamento está registrada — NÃO quando a etapa
 * vira "Faturado", que acontece quando o cliente libera o faturamento.
 * `encerrada(mockup:1188)` era `etapa === 'faturado'`.
 */
export function encerrada(o: Pick<ObraRow, 'marco_faturou'>): boolean {
  return typeof o.marco_faturou === 'string' && o.marco_faturou.trim() !== ''
}
```

Troque a assinatura de `semCobertura` (:489):

```ts
export function semCobertura(
  o: Pick<ObraRow, 'os_aprovada' | 'liberado_por' | 'etapa' | 'marco_faturou'>
): boolean {
  return !o.os_aprovada && !o.liberado_por && o.etapa !== 'definir' && !encerrada(o)
}
```

- [ ] **Step 4: Rodar suítes, tipos e lint**

Run: `npm test -- app/obras/__tests__/tipos.test.ts app/obras/__tests__/base.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: nenhuma saída. Se algum chamador passar objeto sem `marco_faturou` para `encerrada`/`semCobertura`, **pare e reporte**: em 15/09 todos passam `Obra` ou `ObraRow` completos.

- [ ] **Step 5: Commit**

```bash
git add app/obras/_lib/tipos.ts app/obras/__tests__/tipos.test.ts app/obras/__tests__/base.test.ts
git commit -m "feat(obras): obra so encerra com data de faturamento (decisao 12)"
```

**Se o coordenador escolher 12-B** (só os alertas; filtros e KPIs continuam pela etapa): não altere `encerrada`. Acrescente em `tipos.ts`

```ts
/** A Manfac faturou (decisão 12). Tira a obra dos alertas; `encerrada` segue a etapa. */
export function faturada(o: Pick<ObraRow, 'marco_faturou'>): boolean {
  return typeof o.marco_faturou === 'string' && o.marco_faturou.trim() !== ''
}
```

e troque `encerrada(o)` por `faturada(o)` exatamente em: `critico` (a condição `!encerrada(o)`), `encalhada` (`!encerrada(o)`), `classeDias` (primeira linha), `semCobertura` (`!encerrada(o)`, acrescentando `'marco_faturou'` ao `Pick`) e `sev` (primeira linha: `if (faturada(o)) return 'encerrada'`). Os testes de 12-B são os mesmos do Step 1, **menos** as quatro linhas de `encerrada(...)` e o teste novo de `base.test.ts`. Em vez deles, teste `faturada(...)` com os mesmos quatro casos.

---

### Task 6: Verificação final e entrega ao coordenador

**Files:** nenhum código.

- [ ] **Step 1: Suítes do módulo**

Run: `npm test -- app/obras`
Expected: todas as suítes de `app/obras/__tests__` passam.

- [ ] **Step 2: Tipos e lint**

Run: `npx tsc --noEmit -p .`
Expected: nenhuma saída.

Run: `npm run lint`
Expected: nenhum erro novo nos arquivos tocados.

- [ ] **Step 3: Conferir que os arquivos proibidos não mudaram**

Run: `git diff --stat master -- "app/obras/obra/[id]/_actions.ts" "app/obras/obra/[id]/_triagem.tsx" "app/obras/obra/[id]/_ficha.tsx" app/obras/diario app/obras/_ui`
Expected: saída vazia.

- [ ] **Step 4: Reportar ao coordenador, com estes pontos (não corrigir aqui)**

1. `obra/[id]/_ficha.tsx:249-334` (`CaixaAlerta`): com `critico` verdadeiro e `aprovacao` nula, `:289` mostra número vazio, `:298` escreve "contados  dias desde a aprovação" e `:300` escreve "0 vezes". A frente da ficha deve trocar `obra.dias` por `obra.diasAlerta` e o texto por `sufixoDias(obra)`.
2. `diario/_cartao.tsx:228`: cartão vermelho pela contagem nova e texto "N dias desde a aprovação" pela antiga.
3. `obra/[id]/_actions.ts`: a decisão 12 só funciona quando o passo Faturado gravar `marco_faturou`.
4. O rótulo "Dias em aberto" é provisório (spec A5).
