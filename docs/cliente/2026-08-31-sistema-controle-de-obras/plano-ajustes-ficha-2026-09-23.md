# Ajustes da ficha da obra (feedback de 22/09) — Plano de implementação

> **Para agentes:** use `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans`, tarefa por tarefa. Os passos usam checkbox (`- [ ]`).
> **TDD em toda tarefa:** o teste é escrito primeiro, roda e **falha pelo motivo certo**; só então
> o código; o teste passa; commit.

**Objetivo:** os três ajustes do mockup aprovado em 23/09 — nome da etapa de desvio, data de
fechamento da OS (editável ao concluir, corrigível depois, com histórico) e equipe/prestador em texto
livre com sugestões.

**Spec:** `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-ajustes-ficha-2026-09-23.md`.
Toda regra, mensagem de tela e arquivo:linha citado aqui vem de lá. Na dúvida, a spec manda; se a
spec contradisser o mockup `mockup-ajustes-ficha-2026-09-22.html`, **pare e pergunte**.

**Stack:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em Server Action/Component),
Supabase (RPC `obras_aplicar_alteracao`), Jest + ts-jest, React Testing Library + `userEvent`,
Tailwind v4 com hex literais do módulo.

## Restrições globais

- **Sem migration.** Nenhuma tarefa cria coluna, CHECK, função SQL ou policy (spec §3). Se alguma
  parecer precisar, pare.
- **`_actions.ts` é `'use server'`: só exporta funções `async`.** Nada de `export type` nem
  `export const` lá (armadilha 1 de `.claude/rules/obras.md`). Tipos e mensagens vão para
  `app/obras/_lib/ficha-campos.ts`.
- `null` é o único sentinela de vazio; nunca gravar `""` (`_actions.ts:11-12`).
- `hoje` vem sempre de `hojeISO()` no servidor e desce por prop para a tela — o componente não
  calcula hoje.
- Menor mudança. Sem componente compartilhado novo para equipe (dois usos). Sem tratamento de erro
  além do que a spec lista. Borda nova encontrada → anote para a Tarefa 11, não trate.
- Caminhos com `[id]`: no jest, passe o caminho como regex com `.id.` no lugar de `[id]`
  (ex.: `npx jest "app/obras/obra/.id./__tests__/_etapa"`).
- Depois de cada tarefa: o teste da tarefa passa e `npx tsc --noEmit` não acusa erro novo.
- Commits pequenos, um por tarefa, mensagem `feat(obras): ...` / `test(obras): ...`, terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Não pushar.**

## Paralelismo

Critério: duas tarefas só rodam juntas se **não tocam o mesmo arquivo** (código nem teste).

| Onda | Tarefas (em paralelo dentro da onda) | Depende de |
|---|---|---|
| 1 | **T1**, **T2**, **T9**, **T10** | — |
| 2 | **T3**, **T4**, **T7** | T3 ← T2; T4 ← T1; T7 ← T1 |
| 3 | **T5**, **T6** | T5 ← T4 (mesmo `_actions.ts`); T6 ← T1, T4 |
| 4 | **T8** | T3 (mesmo `_ficha.tsx`), T5, T6, T7 |
| 5 | **T11** | todas |

Mapa de arquivos, para conferir o critério:

| Tarefa | Arquivos |
|---|---|
| T1 | `app/obras/_lib/ficha-campos.ts`, `app/obras/__tests__/ficha-campos.test.ts` |
| T2 | `app/obras/_lib/tipos.ts`, `app/obras/__tests__/tipos.test.ts`, `app/obras/__tests__/historico.test.ts` |
| T3 | `app/obras/obra/[id]/_ficha.tsx`, `app/obras/obra/[id]/__tests__/_ficha.test.tsx`, `app/obras/obra/[id]/_bloco-autorizacao.tsx` (comentário) |
| T4 | `app/obras/obra/[id]/_actions.ts`, `app/obras/obra/[id]/__tests__/_actions.test.ts` |
| T5 | `app/obras/obra/[id]/_actions.ts`, `app/obras/obra/[id]/__tests__/_actions.test.ts` |
| T6 | `app/obras/obra/[id]/_etapa.tsx`, `app/obras/obra/[id]/__tests__/_etapa.test.tsx` (novo) |
| T7 | `app/obras/obra/[id]/_corrigir-fechamento.tsx` (novo), `app/obras/obra/[id]/__tests__/_corrigir-fechamento.test.tsx` (novo) |
| T8 | `app/obras/obra/[id]/_ficha.tsx`, `app/obras/obra/[id]/__tests__/_ficha.test.tsx` |
| T9 | `app/obras/obra/[id]/_triagem.tsx`, `app/obras/obra/[id]/__tests__/_triagem-equipe.test.tsx` (novo) |
| T10 | `app/obras/obra/[id]/_bloco-cronograma.tsx`, `app/obras/obra/[id]/__tests__/_blocos-editaveis.test.tsx` |
| T11 | `docs/DIVIDAS.md` |

**Quem executa não revisa.** Depois de cada onda, um agente diferente do executor confere o diff
contra a spec antes da onda seguinte.

---

### Tarefa 1: `validarDataFechamentoOS` — a regra pura da data

**Arquivos:** `app/obras/_lib/ficha-campos.ts` · teste `app/obras/__tests__/ficha-campos.test.ts`

**Produz:** `export function validarDataFechamentoOS(data: string, ctx: { hoje: string; relatorio: string | null; aprovacao: string | null }): string | undefined` (spec §5.2).

- [ ] **Teste primeiro** — novo `describe('validarDataFechamentoOS')` no fim do arquivo:

```ts
const HOJE_F = '2026-09-22'
const CTX = { hoje: HOJE_F, relatorio: '2026-09-18', aprovacao: '2026-09-20' }

it('vazio pede a data', () => {
  expect(validarDataFechamentoOS('', CTX)).toBe('Informe a data de fechamento da OS.')
  expect(validarDataFechamentoOS('   ', CTX)).toBe('Informe a data de fechamento da OS.')
})
it('data que não existe no calendário é inválida', () => {
  expect(validarDataFechamentoOS('2026-02-30', CTX)).toBe('Data inválida.')
})
it('recusa data futura', () => {
  expect(validarDataFechamentoOS('2026-09-23', CTX)).toBe('A data não pode ser posterior a hoje.')
})
it('aceita hoje e a própria data de referência', () => {
  expect(validarDataFechamentoOS(HOJE_F, CTX)).toBeUndefined()
  expect(validarDataFechamentoOS('2026-09-20', CTX)).toBeUndefined()
})
it('caminho com desvio: a referência é a aprovação (a maior das duas)', () => {
  expect(validarDataFechamentoOS('2026-09-19', CTX)).toBe(
    'A data não pode ser anterior à aprovação da OS (20/09/2026).'
  )
})
it('caminho direto: OS aprovada antes do relatório — a referência é o relatório', () => {
  const direto = { hoje: HOJE_F, relatorio: '2026-09-18', aprovacao: '2026-09-14' }
  expect(validarDataFechamentoOS('2026-09-15', direto)).toBe(
    'A data não pode ser anterior ao relatório de entrega (18/09/2026).'
  )
})
it('sem relatório nem aprovação, só a recusa de futuro vale', () => {
  const vazio = { hoje: HOJE_F, relatorio: null, aprovacao: null }
  expect(validarDataFechamentoOS('2020-01-01', vazio)).toBeUndefined()
  expect(validarDataFechamentoOS('2026-09-23', vazio)).toBe('A data não pode ser posterior a hoje.')
})
```

- [ ] Rodar e ver falhar (função não existe): `npx jest app/obras/__tests__/ficha-campos.test.ts`
- [ ] **Implementar** em `ficha-campos.ts`, perto de `erroData` (`:231`): reusar `ISO`,
  `dataDeCalendarioValida` e `MSG_DATA` do próprio arquivo; acrescentar `br` ao import de `./tipos`
  (`:21`). Referência = maior das não nulas; o texto diz "à aprovação da OS" quando a maior é
  `aprovacao`, "ao relatório de entrega" quando é `relatorio` (empate: aprovação).
- [ ] Rodar de novo e ver passar. Commit.

---

### Tarefa 2: renomear `aprovarOS` no catálogo

**Arquivos:** `app/obras/_lib/tipos.ts:165` · testes `app/obras/__tests__/tipos.test.ts:187`,
`app/obras/__tests__/historico.test.ts:158`

- [ ] **Teste primeiro:** em `tipos.test.ts:187` troque o esperado para
  `'Executado - pendente aprovação OS'`; acrescente no mesmo `describe`:

```ts
it('renomear o nome não mexe no valor da planilha nem na chave', () => {
  expect(ETAPAS.aprovarOS.k).toBe('aprovarOS')
  expect(ETAPAS.aprovarOS.planilha).toBe('EXECUTADO - APROVAR OS')
})
```

  Em `historico.test.ts:158` troque `para: 'Pendente fechamento'` por
  `para: 'Executado - pendente aprovação OS'`.
- [ ] Ver falhar: `npx jest app/obras/__tests__/tipos.test.ts app/obras/__tests__/historico.test.ts`
- [ ] **Implementar:** só o `nome` da linha 165. **Não** tocar `planilha` nem `k`.
- [ ] Ver passar. Rodar também `npx jest app/obras/__tests__/importacao.test.ts` (prova de que o
  import, que usa `STATUS_MANFAC_PARA_ETAPA` e não `CICLO.planilha`, não mudou). Commit.

---

### Tarefa 3: nomes escritos à mão na ficha + selo "sempre existe"

**Arquivos:** `app/obras/obra/[id]/_ficha.tsx` (linhas 141-203 `Passo`, 244, 553, 570, `Passo` de
`fecharOS` dentro de `ESTEIRA.map`) · `app/obras/obra/[id]/_bloco-autorizacao.tsx:23` (comentário) ·
teste `app/obras/obra/[id]/__tests__/_ficha.test.tsx`

**Depende de:** T2.

- [ ] **Teste primeiro**, em `_ficha.test.tsx` (use `fichaProps` e `POS_CAMPO` que já existem):

```ts
describe('Nome do desvio e "Fechar OS sempre existe" (ajuste 1, 23/09)', () => {
  it('o nome antigo "Pendente fechamento" não aparece em lugar nenhum da ficha', () => {
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'aprovarOS' })} />)
    expect(screen.queryByText(/Pendente fechamento/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Executado - pendente aprovação OS/).length).toBeGreaterThan(0)
  })
  it('caminho direto: o desvio pulado usa o nome novo', () => {
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'fecharOS', os_aprovada: true,
      aprovacao: '2026-08-20', marco_os_aprov: '2026-08-20' })} />)
    expect(screen.getByText(/Desvio não usado/)).toBeInTheDocument()
    expect(screen.queryByText(/Pendente fechamento/)).not.toBeInTheDocument()
  })
  it('"Fechar OS" leva o selo "sempre existe" nos dois caminhos', () => {
    const { unmount } = render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'aprovarOS' })} />)
    expect(screen.getByText('sempre existe')).toBeInTheDocument()
    unmount()
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'fecharOS', os_aprovada: true,
      aprovacao: '2026-08-20', marco_os_aprov: '2026-08-20' })} />)
    expect(screen.getByText('sempre existe')).toBeInTheDocument()
  })
  it('caminho direto parado em Fechar OS explica que o passo nunca é pulado', () => {
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'fecharOS', os_aprovada: true,
      aprovacao: '2026-08-20', marco_os_aprov: '2026-08-20' })} />)
    expect(screen.getByText(/nunca é pulado/)).toBeInTheDocument()
  })
})
```

  E troque a descrição do `it` da linha 180 ("o desvio \"Pendente fechamento\"…") para o nome novo.
- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_ficha"`
- [ ] **Implementar** (spec §4.2 e §4.3): `nome={c.nome}` na linha 244; `ETAPAS.aprovarOS.nome` nas
  linhas 553 e 570; prop `sempre?: boolean` no `Passo`, selo desenhado como o de `desvio`
  (`_ficha.tsx:182-186`), texto "sempre existe"; `sempre={k === 'fecharOS'}` no `Passo` do map; texto
  "Este passo **nunca é pulado**: é quando o analista de obras insere o relatório no sistema do
  cliente e finaliza a OS lá. Só depois é possível faturar." quando `k === 'fecharOS'`,
  `estado === 'atual'` e `obra.os_aprovada`. Comentário de `_bloco-autorizacao.tsx:23` com o nome novo.
- [ ] Ver passar (inclusive os testes antigos do arquivo). Commit.

---

### Tarefa 4: `mudarEtapaAction` aceita a data de fechamento

**Arquivos:** `app/obras/obra/[id]/_actions.ts` (`calcularMarcosDaEsteira` `:308-331`,
`mudarEtapaAction` `:345-404`) · teste `app/obras/obra/[id]/__tests__/_actions.test.ts`

**Depende de:** T1. **Consome:** `validarDataFechamentoOS`.
**Produz:** `mudarEtapaAction(obraId: string, etapa: string, dataFechamentoOS?: string)`.

- [ ] **Teste primeiro** — novo `describe` no fim de `_actions.test.ts` (reusa `obra()`,
  `camposMarco()`, `linhasMarco()`, `objetoDoUpdate()`, `encadearUpdate()` do arquivo):

```ts
function diasAtras(n: number): string {
  const d = new Date(`${HOJE}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
const br = (iso: string) => iso.split('-').reverse().join('/')

describe('mudarEtapaAction — data de fechamento da OS (ajuste 2, 23/09)', () => {
  const emFecharOS = () => obra({ etapa: 'fecharOS', marco_exec_fim: diasAtras(10),
    marco_relatorio: diasAtras(6), aprovacao: diasAtras(5) })

  it('Fechar OS → Pendente faturamento grava a data informada no marco, com histórico, e em desde_etapa', async () => {
    obraAtual = emFecharOS()
    const r = await mudarEtapaAction('o1', 'pendFat', diasAtras(2))
    expect(r).toEqual({ success: true })
    expect(camposMarco()).toMatchObject({ marco_fechou_os: diasAtras(2) })
    expect(linhasMarco()).toContainEqual(expect.objectContaining(
      { campo: 'marco_fechou_os', de: null, para: br(diasAtras(2)) }))
    expect(objetoDoUpdate()).toMatchObject({ etapa: 'pendFat', desde_etapa: diasAtras(2) })
  })

  it('sem data, continua carimbando hoje (comportamento anterior)', async () => {
    obraAtual = emFecharOS()
    await mudarEtapaAction('o1', 'pendFat')
    expect(camposMarco()).toMatchObject({ marco_fechou_os: HOJE })
    expect(objetoDoUpdate()).toMatchObject({ desde_etapa: HOJE })
  })

  it('data futura é recusada ANTES de qualquer escrita', async () => {
    obraAtual = emFecharOS()
    const r = await mudarEtapaAction('o1', 'pendFat', diasAtras(-1))
    expect(r).toEqual({ error: 'A data não pode ser posterior a hoje.' })
    expect(updateMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('data anterior à aprovação é recusada ANTES de qualquer escrita', async () => {
    obraAtual = emFecharOS()
    const r = await mudarEtapaAction('o1', 'pendFat', diasAtras(6))
    expect(r.error).toMatch(/^A data não pode ser anterior à aprovação da OS/)
    expect(updateMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('data numa troca que não conclui Fechar OS é recusada', async () => {
    obraAtual = obra({ etapa: 'andamento' })
    const r = await mudarEtapaAction('o1', 'relatorio', HOJE)
    expect(r).toEqual({ error: 'A data de fechamento da OS só vale ao concluir Fechar OS.' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('data com o marco já gravado é recusada (quem corrige é "corrigir data")', async () => {
    obraAtual = obra({ etapa: 'pendFat', marco_fechou_os: diasAtras(3), marco_relatorio: diasAtras(6) })
    const r = await mudarEtapaAction('o1', 'faturado', diasAtras(1))
    expect(r.error).toBe('A data de fechamento da OS só vale ao concluir Fechar OS.')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('"Tentar de novo" depois de falha parcial: obra já em pendFat sem marco aceita a data', async () => {
    obraAtual = obra({ etapa: 'pendFat', marco_exec_fim: diasAtras(10),
      marco_relatorio: diasAtras(6), marco_fechou_os: null })
    const r = await mudarEtapaAction('o1', 'pendFat', diasAtras(2))
    expect(r).toEqual({ success: true })
    expect(camposMarco()).toMatchObject({ marco_fechou_os: diasAtras(2) })
  })

  it('Fechar OS → Faturado com data: marco recebe a data, desde_etapa continua hoje', async () => {
    obraAtual = emFecharOS()
    await mudarEtapaAction('o1', 'faturado', diasAtras(2))
    expect(camposMarco()).toMatchObject({ marco_fechou_os: diasAtras(2) })
    expect(objetoDoUpdate()).toMatchObject({ desde_etapa: HOJE })
  })
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_actions.test"`
- [ ] **Implementar** (spec §5.3): calcular `{ antes, depois }` **antes** do `update` (é função
  pura); com `dataFechamentoOS !== undefined`, conferir aplicabilidade pela obra lida
  (`obra.marco_fechou_os === null && ORDEM_ETAPA[etapa] > ORDEM_ETAPA.fecharOS`) e validar com
  `validarDataFechamentoOS(dataFechamentoOS, { hoje, relatorio: depois.marco_relatorio, aprovacao: obra.aprovacao })`
  — as duas recusas retornam sem escrever. `desde_etapa` = data quando aplicável e
  `etapa === 'pendFat'`. `calcularMarcosDaEsteira` ganha o 4º parâmetro opcional
  (`antes ?? dataFechamentoOS` só para `marco_fechou_os`).
- [ ] Ver passar **o arquivo inteiro** (os `describe` antigos, `:110-315`, não mudam). Commit.

---

### Tarefa 5: `corrigirDataFechamentoAction`

**Arquivos:** `app/obras/obra/[id]/_actions.ts` · teste `app/obras/obra/[id]/__tests__/_actions.test.ts`

**Depende de:** T4 (mesmo arquivo). **Produz:** `corrigirDataFechamentoAction(obraId: string, data: string): Promise<EstadoAcao>`.

- [ ] **Teste primeiro** — importe `corrigirDataFechamentoAction` junto de `mudarEtapaAction` e
  acrescente (reusa `diasAtras`/`br` da T4):

```ts
describe('corrigirDataFechamentoAction (ajuste 2, 23/09)', () => {
  const concluida = (over = {}) => obra({ etapa: 'pendFat', marco_relatorio: diasAtras(8),
    aprovacao: diasAtras(7), marco_fechou_os: diasAtras(3), desde_etapa: diasAtras(3), ...over })

  it('sem sessão não grava', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect(await corrigirDataFechamentoAction('o1', diasAtras(4))).toEqual({ error: 'Não autenticado' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('sem acesso ao módulo não grava', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect(await corrigirDataFechamentoAction('o1', diasAtras(4))).toEqual({ error: 'Sem acesso ao Controle de Obras' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('obra que ainda não concluiu Fechar OS não é corrigida', async () => {
    obraAtual = obra({ etapa: 'fecharOS', marco_fechou_os: null })
    expect(await corrigirDataFechamentoAction('o1', diasAtras(1)))
      .toEqual({ error: 'Fechar OS ainda não foi concluído nesta obra.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('corrige com histórico de → para e leva desde_etapa junto quando a espera começou nessa data', async () => {
    obraAtual = concluida()
    expect(await corrigirDataFechamentoAction('o1', diasAtras(5))).toEqual({ success: true })
    expect(camposMarco()).toEqual({ marco_fechou_os: diasAtras(5), desde_etapa: diasAtras(5) })
    expect(linhasMarco()).toEqual([expect.objectContaining(
      { campo: 'marco_fechou_os', de: br(diasAtras(3)), para: br(diasAtras(5)) })])
    expect(revalidatePath).toHaveBeenCalledWith('/obras/obra/o1')
    expect(revalidatePath).toHaveBeenCalledWith('/obras/base')
  })
  it('não toca desde_etapa quando a obra já saiu da espera (faturado) ou a espera começou em outro dia', async () => {
    obraAtual = concluida({ etapa: 'faturado', desde_etapa: diasAtras(1) })
    await corrigirDataFechamentoAction('o1', diasAtras(5))
    expect(camposMarco()).toEqual({ marco_fechou_os: diasAtras(5) })
    obraAtual = concluida({ desde_etapa: diasAtras(1) })
    await corrigirDataFechamentoAction('o1', diasAtras(5))
    expect(camposMarco()).toEqual({ marco_fechou_os: diasAtras(5) })
  })
  it('recusa futuro e anterior à aprovação, sem gravar', async () => {
    obraAtual = concluida()
    expect((await corrigirDataFechamentoAction('o1', diasAtras(-1))).error)
      .toBe('A data não pode ser posterior a hoje.')
    expect((await corrigirDataFechamentoAction('o1', diasAtras(8))).error)
      .toMatch(/^A data não pode ser anterior à aprovação da OS/)
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('mesma data: sucesso sem chamar a RPC', async () => {
    obraAtual = concluida()
    expect(await corrigirDataFechamentoAction('o1', diasAtras(3))).toEqual({ success: true })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('erro da RPC vira mensagem, não exceção', async () => {
    obraAtual = concluida()
    rpcMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await corrigirDataFechamentoAction('o1', diasAtras(5)))
      .toEqual({ error: 'Erro ao corrigir a data de fechamento da OS' })
  })
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_actions.test"`
- [ ] **Implementar** conforme spec §5.6 (`abrirSessao` → `lerObra` → guarda de concluído →
  `validarDataFechamentoOS` com `obra.marco_relatorio`/`obra.aprovacao` → igual = sucesso →
  `linhasDeAlteracao(..., 'Esteira')` → `camposDasLinhas` + `desde_etapa` condicional →
  `gravarComHistorico` → `revalidatePath` ficha e base).
- [ ] Ver passar. Rodar o teste de regressão de `use server` (commit `4071df1`):
  `npx jest __tests__/use-server-exports-async.test.ts`. Commit.

---

### Tarefa 6: `SeletorEtapa` com o campo "Data de fechamento da OS"

**Arquivos:** `app/obras/obra/[id]/_etapa.tsx` · teste novo `app/obras/obra/[id]/__tests__/_etapa.test.tsx`

**Depende de:** T1, T4. **Props novas:** `hoje: string`,
`referenciaFechamento: { relatorio: string | null; aprovacao: string | null }`.

- [ ] **Teste primeiro:**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
jest.mock('../_actions', () => ({ mudarEtapaAction: jest.fn() }))
import { mudarEtapaAction } from '../_actions'
import SeletorEtapa from '../_etapa'

const REF = { relatorio: '2026-09-18', aprovacao: '2026-09-20' }
const montar = (etapa = 'fecharOS') =>
  render(<SeletorEtapa obraId="o1" etapa={etapa as never} hoje="2026-09-22" referenciaFechamento={REF} />)
const acao = mudarEtapaAction as jest.Mock
beforeEach(() => acao.mockReset())

test('Fechar OS → Pendente faturamento mostra a data, preenchida com hoje', async () => {
  const u = userEvent.setup(); montar()
  expect(screen.queryByLabelText('Data de fechamento da OS')).not.toBeInTheDocument()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
  expect(screen.getByLabelText('Data de fechamento da OS')).toHaveValue('2026-09-22')
})
test('outras transições não mostram a data', async () => {
  const u = userEvent.setup(); montar()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'faturado')
  expect(screen.queryByLabelText('Data de fechamento da OS')).not.toBeInTheDocument()
})
test('data futura e anterior à aprovação: erro inline e botão desabilitado', async () => {
  const u = userEvent.setup(); montar()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d); await u.type(d, '2026-09-23')
  expect(screen.getByText('A data não pode ser posterior a hoje.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirmar mudança' })).toBeDisabled()
  await u.clear(d); await u.type(d, '2026-09-19')
  expect(screen.getByText('A data não pode ser anterior à aprovação da OS (20/09/2026).')).toBeInTheDocument()
})
test('confirma com a data escolhida e mostra o salvo com a data', async () => {
  acao.mockResolvedValue({ success: true })
  const u = userEvent.setup(); montar()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d); await u.type(d, '2026-09-21')
  await u.click(screen.getByRole('button', { name: 'Confirmar mudança' }))
  expect(acao).toHaveBeenCalledWith('o1', 'pendFat', '2026-09-21')
  expect(await screen.findByText(/fechamento da OS gravado em/)).toHaveTextContent('21/09/2026')
})
test('troca sem data chama a action só com dois argumentos', async () => {
  acao.mockResolvedValue({ success: true })
  const u = userEvent.setup(); montar('andamento')
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'paralisado')
  await u.click(screen.getByRole('button', { name: 'Confirmar mudança' }))
  expect(acao.mock.calls[0]).toEqual(['o1', 'paralisado'])
})
test('erro com data: título do mockup, mensagem do servidor e "Tentar de novo" reenviando o mesmo', async () => {
  acao.mockResolvedValue({ error: 'A etapa mudou, mas houve erro ao atualizar os marcos da esteira' })
  const u = userEvent.setup(); montar()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
  await u.click(screen.getByRole('button', { name: 'Confirmar mudança' }))
  expect(await screen.findByText('Não concluiu "Fechar OS"')).toBeInTheDocument()
  expect(screen.getByText(/houve erro ao atualizar os marcos/)).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(acao).toHaveBeenLastCalledWith('o1', 'pendFat', '2026-09-22')
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_etapa"`
- [ ] **Implementar** (spec §5.1, §5.5): condição `etapa === 'fecharOS' && escolhida === 'pendFat'`;
  estado `data` iniciado com `hoje` e resetado a cada troca do select; erro de
  `validarDataFechamentoOS` inline com `role="alert"`; `mudarEtapaAction(obraId, escolhida)` sem data,
  `mudarEtapaAction(obraId, escolhida, data)` com; estados salvando/salvo/erro com os textos da spec.
  O `<label>` do select já existe (`htmlFor="troca-etapa"`); o do campo novo é
  "Data de fechamento da OS". **Não** passar a chamar `ficha` ou outra action.
- [ ] Ver passar. `npx tsc --noEmit` vai acusar `_ficha.tsx:581` (props novas obrigatórias) — isso é
  a T8; **não** corrigir aqui. Anote no commit. Commit.

---

### Tarefa 7: componente "corrigir data"

**Arquivos:** novo `app/obras/obra/[id]/_corrigir-fechamento.tsx` · teste novo
`app/obras/obra/[id]/__tests__/_corrigir-fechamento.test.tsx`

**Depende de:** T1. **Produz:** `export default function CorrigirFechamento({ obraId, data, hoje, referencia, corrigir })`
com `corrigir: (obraId: string, data: string) => Promise<{ error?: string; success?: boolean }>`
(tipo declarado **neste** arquivo, não importado de `_actions.ts` — padrão de `SalvarCronograma`,
`_bloco-cronograma.tsx:54-57`).

- [ ] **Teste primeiro:**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CorrigirFechamento from '../_corrigir-fechamento'

const REF = { relatorio: '2026-09-15', aprovacao: '2026-09-16' }
const montar = (corrigir = jest.fn().mockResolvedValue({ success: true })) => {
  render(<CorrigirFechamento obraId="o1" data="2026-09-19" hoje="2026-09-22" referencia={REF} corrigir={corrigir} />)
  return corrigir
}

test('mostra a data e o link "corrigir data"', () => {
  montar()
  expect(screen.getByText(/Fechada no sistema do cliente em/)).toHaveTextContent('19/09/2026')
  expect(screen.getByRole('button', { name: 'corrigir data' })).toBeInTheDocument()
})
test('abre inline com a data atual, avisa do histórico e cancela sem gravar', async () => {
  const u = userEvent.setup(); const corrigir = montar()
  await u.click(screen.getByRole('button', { name: 'corrigir data' }))
  expect(screen.getByLabelText('Data de fechamento da OS')).toHaveValue('2026-09-19')
  expect(screen.getByText(/entra no Histórico de alterações/)).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(corrigir).not.toHaveBeenCalled()
})
test('data futura: erro inline e Salvar desabilitado', async () => {
  const u = userEvent.setup(); montar()
  await u.click(screen.getByRole('button', { name: 'corrigir data' }))
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d); await u.type(d, '2026-09-23')
  expect(screen.getByText('A data não pode ser posterior a hoje.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvar correção' })).toBeDisabled()
})
test('salva, mostra "Corrigido: de → para"', async () => {
  const u = userEvent.setup(); const corrigir = montar()
  await u.click(screen.getByRole('button', { name: 'corrigir data' }))
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d); await u.type(d, '2026-09-17')
  await u.click(screen.getByRole('button', { name: 'Salvar correção' }))
  expect(corrigir).toHaveBeenCalledWith('o1', '2026-09-17')
  expect(await screen.findByText(/Corrigido: de 19\/09\/2026 para 17\/09\/2026/)).toBeInTheDocument()
})
test('erro do servidor aparece e a edição continua aberta', async () => {
  const u = userEvent.setup()
  montar(jest.fn().mockResolvedValue({ error: 'Erro ao corrigir a data de fechamento da OS' }))
  await u.click(screen.getByRole('button', { name: 'corrigir data' }))
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d); await u.type(d, '2026-09-17')
  await u.click(screen.getByRole('button', { name: 'Salvar correção' }))
  expect(await screen.findByText('Erro ao corrigir a data de fechamento da OS')).toBeInTheDocument()
  expect(screen.getByLabelText('Data de fechamento da OS')).toBeInTheDocument()
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_corrigir-fechamento"`
- [ ] **Implementar** conforme spec §5.7 (`'use client'`, `useTransition`, `max={hoje}` no input,
  "Salvando…" com o botão desabilitado; erro de rede → `ERRO_DE_REDE` de `_bloco-editavel.tsx`, como os
  blocos fazem). Hex do tema do módulo; nada de cor nova.
- [ ] Ver passar. Commit.

---

### Tarefa 8: ligar tudo na ficha

**Arquivos:** `app/obras/obra/[id]/_ficha.tsx` · teste `app/obras/obra/[id]/__tests__/_ficha.test.tsx`

**Depende de:** T3, T5, T6, T7.

- [ ] **Teste primeiro**, em `_ficha.test.tsx`:

```ts
describe('Data de fechamento da OS na ficha (ajuste 2, 23/09)', () => {
  it('Fechar OS concluído mostra a data e "corrigir data"', () => {
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'pendFat',
      marco_relatorio: '2026-09-15', marco_fechou_os: '2026-09-19' })} />)
    expect(screen.getByText(/Fechada no sistema do cliente em/)).toHaveTextContent('19/09/2026')
    expect(screen.getByRole('button', { name: 'corrigir data' })).toBeInTheDocument()
  })
  it('Fechar OS atual ou futuro não oferece "corrigir data"', () => {
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'fecharOS' })} />)
    expect(screen.queryByRole('button', { name: 'corrigir data' })).not.toBeInTheDocument()
  })
  it('o seletor de etapa recebe hoje e a referência (campo aparece em Fechar OS → Pendente faturamento)', async () => {
    const u = userEvent.setup()
    render(<Ficha {...fichaProps({ ...POS_CAMPO, etapa: 'fecharOS' })} />)
    await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
    expect(screen.getByLabelText('Data de fechamento da OS')).toHaveValue(HOJE)
  })
})
```

  (importe `userEvent` de `@testing-library/user-event` se o arquivo ainda não importa; confira que
  `POS_CAMPO` não define `marco_fechou_os` — se definir, sobrescreva com `null` no segundo caso.)
- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_ficha"`
- [ ] **Implementar:** `<SeletorEtapa … hoje={hoje} referenciaFechamento={{ relatorio: obra.marco_relatorio, aprovacao: obra.aprovacao }} />`
  (`_ficha.tsx:581`); `Esteira` recebe `hoje` e `corrigir={corrigirDataFechamentoAction}` (import junto
  das outras actions, `_ficha.tsx:70-75`); no `Passo` de `fecharOS` com `estado === 'feito'`,
  renderizar `<CorrigirFechamento obraId={obra.id} data={data} hoje={hoje} referencia={…} corrigir={corrigir} />`.
- [ ] Ver passar. `npx tsc --noEmit` limpo. Commit.

---

### Tarefa 9: equipe em texto livre na Triagem

**Arquivos:** `app/obras/obra/[id]/_triagem.tsx` (campo 2, `:478-491`; `faltam`, `:194`) · teste novo
`app/obras/obra/[id]/__tests__/_triagem-equipe.test.tsx`

- [ ] **Teste primeiro.** A Triagem importa `useRouter` e as actions direto: mocke os dois. Monte a
  `Obra` com `derivar(obraRow({ etapa: 'definir' }), '2026-09-23')`, copiando o `obraRow` de
  `_ficha.test.tsx:30-75`. Leia a assinatura de `Triagem` (`_triagem.tsx:155-170`) para as props.

```tsx
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('../_actions', () => ({ liberarObraAction: jest.fn(), salvarDadosTriagemAction: jest.fn() }))

test('equipe é campo de texto com as equipes já usadas como sugestão', () => {
  renderTriagem({ equipes: ['ALEX', 'MANFAC-7'] })
  const campo = screen.getByLabelText('Equipe ou prestador')
  expect(campo).toHaveAttribute('type', 'text')
  const lista = document.getElementById(campo.getAttribute('list')!)!
  expect([...lista.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual(['ALEX', 'MANFAC-7'])
  expect(screen.getByText('Comece a digitar para ver equipes já usadas. Qualquer texto é aceito.')).toBeInTheDocument()
})
test('texto fora da lista é aceito e conta como preenchido', async () => {
  const u = userEvent.setup(); renderTriagem({ equipes: ['ALEX'] })
  await u.type(screen.getByLabelText('Equipe ou prestador'), 'GRUPO SERTAO MANUTENCAO')
  expect(screen.getByLabelText('Equipe ou prestador')).toHaveValue('GRUPO SERTAO MANUTENCAO')
  expect(screen.getByText(/Faltam 4 campos/)).toBeInTheDocument()
})
test('só espaço não conta como preenchido', async () => {
  const u = userEvent.setup(); renderTriagem({ equipes: [] })
  await u.type(screen.getByLabelText('Equipe ou prestador'), '   ')
  expect(screen.getByText(/Faltam 5 campos/)).toBeInTheDocument()
})
```

  (Ajuste "Faltam N" ao número real de campos vazios da obra montada — o ponto é que o texto livre
  reduz em 1 e o só-espaço não.)
- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_triagem-equipe"`
- [ ] **Implementar** (spec §6.2): `<input type="text" list="equipes-tri" autoComplete="off" placeholder="Digite a equipe ou o prestador" aria-label="Equipe ou prestador" className={INPUT} …>` +
  `<datalist id="equipes-tri">` com `equipes`; `dica` no `CampoTri`; `preenchido={!!t.equipe.trim()}`
  e o `faltam` (`:194`) olhando `.trim()` para `equipe`.
- [ ] Ver passar. Commit.

---

### Tarefa 10: equipe em texto livre no bloco Cronograma

**Arquivos:** `app/obras/obra/[id]/_bloco-cronograma.tsx:241-249` · teste
`app/obras/obra/[id]/__tests__/_blocos-editaveis.test.tsx`

- [ ] **Teste primeiro**, no fim de `_blocos-editaveis.test.tsx` (mesmo `render` de
  `BlocoCronograma` do teste da linha 86):

```tsx
test('cronograma: equipe aceita texto livre, com sugestões das equipes já usadas', async () => {
  const u = userEvent.setup()
  const salvar = jest.fn().mockResolvedValue({ success: true })
  render(<BlocoCronograma obraId="o1"
    valores={{ resp: 'LUANA', equipe: 'MANFAC-7', prioridade: 'Normal', inicio: '2026-08-24', duracao: '20' }}
    responsaveis={['LUANA']} equipes={['ALEX', 'MANFAC-7']} motivos={['Clima', 'Outro']}
    rodape={null} salvar={salvar} />)
  await u.click(screen.getByRole('button', { name: 'Editar Cronograma' }))
  const campo = screen.getByLabelText('Equipe / prestador')
  expect(campo).toHaveAttribute('type', 'text')
  const lista = document.getElementById(campo.getAttribute('list')!)!
  expect(lista.querySelectorAll('option')).toHaveLength(2)
  await u.clear(campo)
  await u.type(campo, 'GRUPO SERTAO MANUTENCAO')
  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(salvar).toHaveBeenCalledWith('o1', expect.objectContaining({ equipe: 'GRUPO SERTAO MANUTENCAO' }))
})
```

- [ ] Ver falhar: `npx jest "app/obras/obra/.id./__tests__/_blocos-editaveis"`
- [ ] **Implementar:** trocar o `Selecao` de equipe por
  `<Entrada id="b-cro-equipe" valor={rascunho.equipe} desabilitado={salvando} list="equipes-cro" autoComplete="off" placeholder="Digite a equipe ou o prestador" onChange={(v) => campo('equipe', v)} />`
  + `<datalist id="equipes-cro">`. `Selecao` continua importado (usado por responsável e prioridade).
- [ ] Ver passar (os testes antigos do arquivo também). Commit.

---

### Tarefa 11: dívidas + verificação final

**Arquivos:** `docs/DIVIDAS.md`

- [ ] Acrescentar à seção (A) as **6 linhas** da spec §8, no formato do arquivo (o que é, âncora
  `arquivo:linha` **já com as linhas do código novo**, data 23/09/2026, motivo, consequência). A linha
  1 cita a A13 como origem.
- [ ] `npm test` — o número que importa são as suítes do hub (as 7 do `manfac-site/` falham por
  resolução de módulo e não contam, `AGENTS.md`). Zero falha nova.
- [ ] `npm run lint` e `npm run build` limpos (a dívida B9 — lint varrendo worktrees — pode gerar
  ruído fora de `app/`; conferir que nada vem de arquivo tocado aqui).
- [ ] **Teste manual** em `npm run dev`, numa obra de teste: (1) nome novo na esteira, no select e na
  Base; (2) Fechar OS → Pendente faturamento com data de ontem, conferir marco, "há 1 dia" no passo
  atual e a linha no Histórico; (3) corrigir para anteontem, conferir a linha "de → para" com o seu
  e-mail; (4) data futura recusada nas duas telas; (5) equipe nova digitada na Triagem e no
  Cronograma, e ela aparecendo como sugestão na próxima obra. **No celular** (largura ~375px):
  datalist visível e campo de data utilizável.
- [ ] Commit. **Não pushar** — o deploy é decisão do João.

---

## Autoconferência contra a spec

| Spec | Tarefa |
|---|---|
| §4.1 renomear `nome`, `planilha` intocado | T2 |
| §4.2 nomes à mão | T3 |
| §4.3 selo + texto do caminho direto | T3 |
| §5.1 campo condicional no seletor | T6, T8 |
| §5.2 regra pura (futuro, referência = maior das duas) | T1 |
| §5.3 servidor revalida antes de escrever; `desde_etapa` = data | T4 |
| §5.4 "Tentar de novo" recupera falha parcial | T4 (servidor), T6 (tela) |
| §5.5 estados | T6 |
| §5.6 correção com histórico, guarda de concluído, `desde_etapa` condicional | T5 |
| §5.7 tela da correção | T7, T8 |
| §6 equipe texto livre | T9, T10 |
| §8 dívidas | T11 |
