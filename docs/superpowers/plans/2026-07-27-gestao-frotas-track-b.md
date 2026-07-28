# Gestão de Frotas — Track B (checklist com evidência real) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fecha os 4 achados de UX da auditoria que exigiam mockup/decisão do cliente (U-02, U-03, U-05, U-08) — checklist tri-state com fotos obrigatórias enviadas antes do registro existir, tela de detalhe que exibe as fotos, upload opcional em Documentos, e compressão de imagem uniforme — mais o ajuste de descoberta do histórico do veículo que fecha de vez o item 1 do feedback original do cliente.

**Architecture:** Mudança em 3 módulos do Sofia (`checklist`, `sinistros`, `documentos`) + 1 ajuste em `veiculos`. O núcleo técnico é inverter a ordem de submit de checklist e sinistro: hoje o registro é criado primeiro e as fotos sobem depois (podendo ficar "órfão" sem foto se o upload falhar); passa a ser upload no storage primeiro (via um id gerado no cliente com `crypto.randomUUID()`), e só então uma única chamada de Server Action grava o registro e as linhas de foto juntos. Um helper compartilhado (`lib/sofia/uploadFotos.ts`) concentra essa lógica de upload para os dois formulários.

**Tech Stack:** Next.js 16 App Router (Server Actions + `useActionState`), Supabase (Postgres + Storage privado com signed URLs), TypeScript, Tailwind v4, Jest + Testing Library.

## Global Constraints

- Next 16 custom nesta base: Server Actions têm limite de 1MB de body por padrão (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:83`) — arquivos/fotos NUNCA podem viajar dentro do FormData de uma Server Action; sempre sobem primeiro via `createClient()` do browser (`lib/supabase/client`) direto pro Supabase Storage, e a Server Action recebe só o `storage_path` (string).
- Buckets `checklist-fotos` e `sofia-anexos` já existem com policy `authenticated upload/read` (`sdd-sql-passo3.sql`) — nenhuma migração de storage nesta spec.
- Nenhuma foto pode ser perdida silenciosamente: qualquer falha de upload interrompe o fluxo ANTES de qualquer escrita no banco.
- Padrão de admin/RLS do módulo Sofia não muda nesta spec (fora de escopo — ver achados B-01/B-02 já fechados no pacote de segurança).
- Todo código novo em `lib/sofia/` e `app/(operacoes)/sofia/**` segue o estilo dark navy já estabelecido (classes Tailwind `bg-[#0d2050]`, `border-[#1e3a5f]`, `text-[#f05a28]` etc.) — copiar o padrão dos arquivos vizinhos, não inventar um novo.

---

## Task 1: Migração SQL + tipos — `itens_problemas`

**Files:**
- Create: `sdd-sql-track-b.sql`
- Modify: `lib/sofia/types.ts:71-98` (interface `Checklist`)

**Interfaces:**
- Produces: coluna `checklist.itens_problemas jsonb not null default '{}'`, campo `itens_problemas: Record<string, string>` em `Checklist`.

- [ ] **Step 1: Criar a migração standalone**

```sql
-- sdd-sql-track-b.sql
-- Track B da auditoria (achado U-02): descrição do problema por item de
-- checklist, quando o item é marcado "Problema" em vez de "OK".
-- Rodar manualmente no Supabase Dashboard (projeto iyytcavcgukfjnjjrerx)
-- ANTES do deploy do código desta spec.

alter table public.checklist
  add column if not exists itens_problemas jsonb not null default '{}';
```

- [ ] **Step 2: Atualizar o tipo `Checklist`**

Em `lib/sofia/types.ts`, adicionar o campo depois de `triangulo_ok`:

```ts
  triangulo_ok: boolean | null
  itens_problemas: Record<string, string>
```

- [ ] **Step 3: Commit**

```bash
git add sdd-sql-track-b.sql lib/sofia/types.ts
git commit -m "feat(sofia): migração itens_problemas do checklist (Track B, U-02)"
```

---

## Task 2: Centraliza tipos de Documento em `enums.ts`

**Files:**
- Modify: `lib/sofia/types.ts:9` (`DocumentoVeiculoTipo`)
- Modify: `lib/sofia/enums.ts`
- Modify: `app/(operacoes)/sofia/documentos/novo/_form.tsx:38-45`
- Modify: `app/(operacoes)/sofia/documentos/page.tsx:27-34`
- Test: `lib/sofia/__tests__/enums.test.ts`

**Interfaces:**
- Produces: `DOCUMENTO_TIPOS: readonly DocumentoVeiculoTipo[]`, `DOCUMENTO_TIPO_LABELS: Record<DocumentoVeiculoTipo, string>` em `lib/sofia/enums.ts`.

- [ ] **Step 1: Adicionar `'contrato_locacao'` ao tipo**

Em `lib/sofia/types.ts:9`:

```ts
export type DocumentoVeiculoTipo = 'seguro' | 'licenciamento' | 'ipva' | 'contrato_locacao' | 'outro'
```

- [ ] **Step 2: Escrever o teste que trava a lista e os rótulos**

Em `lib/sofia/__tests__/enums.test.ts`, adicionar (mantendo os `describe` já existentes):

```ts
import { DOCUMENTO_TIPOS, DOCUMENTO_TIPO_LABELS } from '../enums'

describe('DOCUMENTO_TIPOS', () => {
  it('inclui os 5 tipos, incluindo o novo Contrato de locação', () => {
    expect(DOCUMENTO_TIPOS).toEqual(['seguro', 'licenciamento', 'ipva', 'contrato_locacao', 'outro'])
  })

  it('tem rótulo para todo tipo (typecheck garante isso, teste garante o texto)', () => {
    expect(DOCUMENTO_TIPO_LABELS.contrato_locacao).toBe('Contrato de locação')
    expect(Object.keys(DOCUMENTO_TIPO_LABELS)).toHaveLength(DOCUMENTO_TIPOS.length)
  })
})
```

- [ ] **Step 2b: Rodar e ver falhar**

Run: `npx jest lib/sofia/__tests__/enums.test.ts`
Expected: FAIL — `DOCUMENTO_TIPOS`/`DOCUMENTO_TIPO_LABELS` não existem ainda.

- [ ] **Step 3: Implementar em `enums.ts`**

Adicionar ao final de `lib/sofia/enums.ts` (junto do import de tipos no topo, incluir `DocumentoVeiculoTipo`):

```ts
import type {
  VeiculoStatus,
  MultaStatus,
  SinistroStatus,
  PendenciaStatus,
  AutorizacaoStatus,
  ChecklistTipo,
  DocumentoVeiculoTipo,
} from './types'
```

```ts
export const DOCUMENTO_TIPOS = [
  'seguro',
  'licenciamento',
  'ipva',
  'contrato_locacao',
  'outro',
] as const satisfies readonly DocumentoVeiculoTipo[]

export const DOCUMENTO_TIPO_LABELS: Record<DocumentoVeiculoTipo, string> = {
  seguro: 'Seguro',
  licenciamento: 'Licenciamento (CRLV)',
  ipva: 'IPVA',
  contrato_locacao: 'Contrato de locação',
  outro: 'Outro',
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest lib/sofia/__tests__/enums.test.ts`
Expected: PASS

- [ ] **Step 5: Usar a lista centralizada no formulário**

Em `app/(operacoes)/sofia/documentos/novo/_form.tsx`, importar `DOCUMENTO_TIPOS, DOCUMENTO_TIPO_LABELS` de `@/lib/sofia/enums` e trocar as `<option>` fixas (linhas 40-44) por:

```tsx
{DOCUMENTO_TIPOS.map((t) => (
  <option key={t} value={t}>{DOCUMENTO_TIPO_LABELS[t]}</option>
))}
```

- [ ] **Step 6: Usar a lista centralizada na listagem**

Em `app/(operacoes)/sofia/documentos/page.tsx`, remover o `tipoLabel` local (linhas 27-32) e importar `DOCUMENTO_TIPO_LABELS as tipoLabel` de `@/lib/sofia/enums` no lugar (mantém o resto do arquivo, que já usa `tipoLabel[...]`, sem outras mudanças):

```ts
import { DOCUMENTO_TIPO_LABELS as tipoLabel } from '@/lib/sofia/enums'
```

- [ ] **Step 7: Rodar a suíte completa e o build**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, sem erros de tipo

- [ ] **Step 8: Commit**

```bash
git add lib/sofia/types.ts lib/sofia/enums.ts lib/sofia/__tests__/enums.test.ts app/\(operacoes\)/sofia/documentos/novo/_form.tsx app/\(operacoes\)/sofia/documentos/page.tsx
git commit -m "feat(sofia): centraliza tipos de documento em enums.ts, adiciona Contrato de locação (U-05)"
```

---

## Task 3: `comprimirImagem` — compressão uniforme

**Files:**
- Create: `lib/sofia/comprimirImagem.ts`
- Test: `lib/sofia/__tests__/comprimirImagem.test.ts`

**Interfaces:**
- Produces: `comprimirImagem(file: Blob): Promise<Blob>` — redimensiona o maior lado pra 1600px (mantendo proporção; não aumenta imagem menor que isso) e reexporta como JPEG qualidade 0.85.

Não há pacote `canvas` instalado (`node_modules/canvas` não existe), então o teste não pode renderizar pixels reais em jsdom — ele mocka `Image`, `HTMLCanvasElement.getContext` e `canvas.toBlob` pra travar a MATEMÁTICA do redimensionamento e o formato de saída, que é o que a spec pede ("dimensão de saída, redução de tamanho").

- [ ] **Step 1: Escrever o teste com Image/canvas mockados**

```ts
// lib/sofia/__tests__/comprimirImagem.test.ts
import { comprimirImagem } from '../comprimirImagem'

class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 0
  height = 0
  private _src = ''
  set src(v: string) {
    this._src = v
    queueMicrotask(() => this.onload?.())
  }
  get src() {
    return this._src
  }
}

function mockCanvas(outputBlob: Blob) {
  const drawImage = jest.fn()
  const toBlob = jest.fn((cb: (b: Blob | null) => void, _type: string, _quality: number) => cb(outputBlob))
  const canvas = { width: 0, height: 0, getContext: jest.fn(() => ({ drawImage })), toBlob } as unknown as HTMLCanvasElement
  jest.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLElement)
  return { canvas, drawImage, toBlob }
}

describe('comprimirImagem', () => {
  const originalImage = global.Image
  const originalCreateObjectURL = global.URL.createObjectURL
  const originalRevokeObjectURL = global.URL.revokeObjectURL

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = MockImage as any
    global.URL.createObjectURL = jest.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    global.Image = originalImage
    global.URL.createObjectURL = originalCreateObjectURL
    global.URL.revokeObjectURL = originalRevokeObjectURL
    jest.restoreAllMocks()
  })

  it('redimensiona o maior lado pra 1600px preservando a proporção (imagem larga)', async () => {
    const outputBlob = new Blob(['comprimido'], { type: 'image/jpeg' })
    const { canvas } = mockCanvas(outputBlob)

    class WideImage extends MockImage {
      set src(v: string) {
        this.width = 3200
        this.height = 2400
        queueMicrotask(() => this.onload?.())
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = WideImage as any

    const result = await comprimirImagem(new Blob(['original'], { type: 'image/jpeg' }))
    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(1200)
    expect(result).toBe(outputBlob)
  })

  it('não aumenta imagem já menor que 1600px no maior lado', async () => {
    const outputBlob = new Blob(['comprimido'], { type: 'image/jpeg' })
    const { canvas } = mockCanvas(outputBlob)

    class SmallImage extends MockImage {
      set src(v: string) {
        this.width = 800
        this.height = 600
        queueMicrotask(() => this.onload?.())
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = SmallImage as any

    const result = await comprimirImagem(new Blob(['original'], { type: 'image/jpeg' }))
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
    expect(result).toBe(outputBlob)
  })

  it('exporta como JPEG qualidade 0.85', async () => {
    const outputBlob = new Blob(['comprimido'], { type: 'image/jpeg' })
    const { toBlob } = mockCanvas(outputBlob)

    await comprimirImagem(new Blob(['original'], { type: 'image/jpeg' }))

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest lib/sofia/__tests__/comprimirImagem.test.ts`
Expected: FAIL — módulo `../comprimirImagem` não existe.

- [ ] **Step 3: Implementar**

```ts
// lib/sofia/comprimirImagem.ts
const LADO_MAXIMO = 1600
const QUALIDADE_JPEG = 0.85

/**
 * Redimensiona o maior lado da imagem pra no máximo 1600px (sem ampliar
 * imagens menores) e reexporta como JPEG qualidade 0.85 via canvas.
 * Usada uniformemente nos dois caminhos do CameraCapture (câmera e galeria)
 * e no anexo de imagem em Documentos — antes só a captura por câmera
 * comprimia, a escolha por galeria subia o arquivo original sem tratamento
 * (achado U-08 da auditoria).
 */
export async function comprimirImagem(file: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Falha ao carregar imagem para compressão'))
      image.src = objectUrl
    })

    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
    const largura = Math.round(img.width * escala)
    const altura = Math.round(img.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D não disponível')
    ctx.drawImage(img, 0, 0, largura, altura)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar blob comprimido'))),
        'image/jpeg',
        QUALIDADE_JPEG
      )
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest lib/sofia/__tests__/comprimirImagem.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/sofia/comprimirImagem.ts lib/sofia/__tests__/comprimirImagem.test.ts
git commit -m "feat(sofia): comprimirImagem redimensiona e reexporta JPEG 0.85 (U-08)"
```

---

## Task 4: `CameraCapture` usa `comprimirImagem` nos dois caminhos

**Files:**
- Modify: `components/sofia/CameraCapture.tsx`

**Interfaces:**
- Consumes: `comprimirImagem(file: Blob): Promise<Blob>` (Task 3)

- [ ] **Step 1: Aplicar compressão no caminho de câmera**

Em `capture()` (linhas 39-70), o `canvas.toBlob` já gera um JPEG 0.85 mas sem redimensionamento — trocar a chamada de `onCapture` para passar o blob pela compressão:

```ts
  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const dataUrl = canvas.toDataURL('image/jpeg')
      setCaptured(dataUrl)

      const stream = video.srcObject as MediaStream
      stream?.getTracks().forEach((t) => t.stop())
      setStreaming(false)

      let lat: number | null = null
      let lng: number | null = null
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch (geoError) {
        console.warn('Não foi possível obter localização para a foto:', geoError)
      }

      const comprimido = await comprimirImagem(blob)
      onCapture(comprimido, posicao, lat, lng)
    }, 'image/jpeg', 0.85)
  }, [posicao, onCapture])
```

- [ ] **Step 2: Aplicar compressão no caminho de galeria**

`handleFileChange` hoje passa o `File` original direto pro `onCapture` (linha 79), sem nenhum tratamento — trocar para:

```ts
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => setCaptured(ev.target?.result as string)
      reader.readAsDataURL(file)
      const comprimido = await comprimirImagem(file)
      onCapture(comprimido, posicao, null, null)
    },
    [posicao, onCapture]
  )
```

- [ ] **Step 3: Importar `comprimirImagem`**

No topo do arquivo:

```ts
import { comprimirImagem } from '@/lib/sofia/comprimirImagem'
```

- [ ] **Step 4: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (não há teste de render pra `CameraCapture` — depende de `getUserMedia`/canvas real de browser, fora do escopo de jsdom; a lógica de compressão em si já está coberta pelo teste da Task 3)

- [ ] **Step 5: Commit**

```bash
git add components/sofia/CameraCapture.tsx
git commit -m "feat(sofia): CameraCapture comprime também o caminho de galeria (U-08)"
```

---

## Task 5: Checklist tri-state — validação

**Files:**
- Modify: `app/(operacoes)/sofia/checklist/_validation.ts`
- Modify: `app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts`

**Interfaces:**
- Produces: `ChecklistItemStatus = boolean | null`, `ChecklistItens` com valores tri-state, `ParsedChecklistInput.id: string`, `.itens_problemas: Record<string,string>`, `.fotos: Record<string, { path: string; lat: number | null; lng: number | null }>`, `FOTO_POSICOES_OBRIGATORIAS: readonly string[]`, `FOTO_POSICAO_OPCIONAL: string`.
- Consumes (later tasks): Task 6 usa todos os campos acima pra montar o insert; Task 7 usa `FOTO_POSICOES_OBRIGATORIAS`/`FOTO_POSICAO_OPCIONAL` pra renderizar o formulário.

- [ ] **Step 1: Reescrever `_validation.ts`**

```ts
// app/(operacoes)/sofia/checklist/_validation.ts

/** true = OK, false = Problema, null = não respondido ainda. */
export type ChecklistItemStatus = boolean | null

export interface ChecklistItens {
  lataria_ok: ChecklistItemStatus
  vidros_ok: ChecklistItemStatus
  pneus_ok: ChecklistItemStatus
  combustivel_ok: ChecklistItemStatus
  itens_internos_ok: ChecklistItemStatus
  estepe_ok: ChecklistItemStatus
  macaco_ok: ChecklistItemStatus
  triangulo_ok: ChecklistItemStatus
}

export interface FotoUpload {
  path: string
  lat: number | null
  lng: number | null
}

export const FOTO_POSICOES_OBRIGATORIAS = ['Frente', 'Traseira', 'Lateral Esq.', 'Lateral Dir.'] as const
export const FOTO_POSICAO_OPCIONAL = 'Interna'

export interface ParsedChecklistInput {
  id: string
  tipo: string
  equipe_id: string | null
  veiculo_id: string
  motorista_id: string | null
  equipe_destino_id: string | null
  motorista_destino_id: string | null
  observacoes: string | null
  latitude: number | null
  longitude: number | null
  avaria_identificada: boolean
  avaria_descricao: string | null
  chave_entregue: boolean
  cartao_combustivel_entregue: boolean
  assinatura_motorista: boolean
  itens: ChecklistItens
  itens_problemas: Record<string, string>
  fotos: Record<string, FotoUpload>
}

function parseItemStatus(raw: string | null): ChecklistItemStatus {
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

/**
 * Parses the raw FormData submitted by the checklist form into a typed,
 * null-safe shape. Fields that are optional in the form (e.g. `observacoes`,
 * `motorista_id`) may legitimately be absent from FormData — `formData.get()`
 * returns `null` in that case, so every string field is read as
 * `string | null` before any string method (like `.trim()`) is called on it.
 *
 * `itens_problemas` e `fotos` chegam como um único campo JSON cada — o
 * formulário monta esses dois mapas em memória (descrição por item marcado
 * "Problema", caminho de storage por posição de foto já enviada) porque não
 * dá pra confiar num conjunto variável de `<input>` nomeados quando o
 * conjunto de fotos é dinâmico.
 */
export function parseChecklistFormData(formData: FormData): ParsedChecklistInput {
  const id = (formData.get('id') as string | null) ?? ''
  const tipo = (formData.get('tipo') as string | null) ?? ''
  const equipe_id = (formData.get('equipe_id') as string | null) || null
  const veiculo_id = (formData.get('veiculo_id') as string | null) ?? ''
  const motorista_id = (formData.get('motorista_id') as string | null) || null
  const equipe_destino_id = (formData.get('equipe_destino_id') as string | null) || null
  const motorista_destino_id = (formData.get('motorista_destino_id') as string | null) || null
  const observacoes = (formData.get('observacoes') as string | null)?.trim() || null
  const latitude = formData.get('latitude') ? Number(formData.get('latitude')) : null
  const longitude = formData.get('longitude') ? Number(formData.get('longitude')) : null
  const avaria_identificada = formData.get('avaria_identificada') === 'true'
  const avaria_descricao = (formData.get('avaria_descricao') as string | null)?.trim() || null
  const chave_entregue = formData.get('chave_entregue') === 'true'
  const cartao_combustivel_entregue = formData.get('cartao_combustivel_entregue') === 'true'
  const assinatura_motorista = formData.get('assinatura_motorista') === 'true'

  const itens: ChecklistItens = {
    lataria_ok: parseItemStatus(formData.get('lataria_ok') as string | null),
    vidros_ok: parseItemStatus(formData.get('vidros_ok') as string | null),
    pneus_ok: parseItemStatus(formData.get('pneus_ok') as string | null),
    combustivel_ok: parseItemStatus(formData.get('combustivel_ok') as string | null),
    itens_internos_ok: parseItemStatus(formData.get('itens_internos_ok') as string | null),
    estepe_ok: parseItemStatus(formData.get('estepe_ok') as string | null),
    macaco_ok: parseItemStatus(formData.get('macaco_ok') as string | null),
    triangulo_ok: parseItemStatus(formData.get('triangulo_ok') as string | null),
  }

  let itens_problemas: Record<string, string> = {}
  try {
    itens_problemas = JSON.parse((formData.get('itens_problemas') as string | null) || '{}')
  } catch {
    itens_problemas = {}
  }

  let fotos: Record<string, FotoUpload> = {}
  try {
    fotos = JSON.parse((formData.get('fotos') as string | null) || '{}')
  } catch {
    fotos = {}
  }

  return {
    id,
    tipo,
    equipe_id,
    veiculo_id,
    motorista_id,
    equipe_destino_id,
    motorista_destino_id,
    observacoes,
    latitude,
    longitude,
    avaria_identificada,
    avaria_descricao,
    chave_entregue,
    cartao_combustivel_entregue,
    assinatura_motorista,
    itens,
    itens_problemas,
    fotos,
  }
}

/**
 * Validates a parsed checklist input. Returns an error message (in Portuguese,
 * surfaced directly to the user) or `null` when the input is valid.
 */
export function validateChecklistInput(input: ParsedChecklistInput): string | null {
  if (!input.id) return 'Erro interno: identificador do checklist ausente'
  if (!input.tipo || !input.veiculo_id) {
    return 'Tipo e veículo são obrigatórios'
  }
  const exigeEquipe = ['saida', 'retorno', 'devolucao'].includes(input.tipo)
  if (exigeEquipe && !input.equipe_id) {
    return 'Equipe é obrigatória para este tipo de checklist'
  }
  if (input.tipo === 'troca' && !input.equipe_destino_id) {
    return 'Equipe de destino é obrigatória numa troca'
  }
  if (!input.assinatura_motorista) {
    return 'Confirmação do motorista é obrigatória'
  }

  const itemKeys = Object.keys(input.itens) as (keyof ChecklistItens)[]
  if (itemKeys.some((k) => input.itens[k] === null)) {
    return 'Todos os 8 itens de verificação devem ser respondidos'
  }

  const fotosFaltando = FOTO_POSICOES_OBRIGATORIAS.filter((p) => !input.fotos[p]?.path)
  if (fotosFaltando.length > 0) {
    return `Fotos obrigatórias faltando: ${fotosFaltando.join(', ')}`
  }

  return null
}
```

- [ ] **Step 2: Reescrever `_validation.test.ts`**

```ts
// app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts
import { parseChecklistFormData, validateChecklistInput, FOTO_POSICOES_OBRIGATORIAS } from '../_validation'
import type { ParsedChecklistInput } from '../_validation'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value)
  }
  return fd
}

const FOTOS_OBRIGATORIAS_JSON = JSON.stringify({
  Frente: { path: 'checklist-1/Frente-1.jpg', lat: null, lng: null },
  Traseira: { path: 'checklist-1/Traseira-1.jpg', lat: null, lng: null },
  'Lateral Esq.': { path: 'checklist-1/Lateral-Esq.-1.jpg', lat: null, lng: null },
  'Lateral Dir.': { path: 'checklist-1/Lateral-Dir.-1.jpg', lat: null, lng: null },
})

describe('parseChecklistFormData', () => {
  it('parses all fields from a fully-filled FormData', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'troca',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      motorista_id: 'm1',
      equipe_destino_id: 'e2',
      motorista_destino_id: 'm2',
      observacoes: '  tudo certo  ',
      latitude: '-23.5',
      longitude: '-46.6',
      avaria_identificada: 'true',
      avaria_descricao: '  arranhão na porta  ',
      chave_entregue: 'true',
      cartao_combustivel_entregue: 'true',
      assinatura_motorista: 'true',
      lataria_ok: 'true',
      vidros_ok: 'false',
      itens_problemas: JSON.stringify({ vidros_ok: 'trinca no para-brisa' }),
      fotos: FOTOS_OBRIGATORIAS_JSON,
    })

    const parsed = parseChecklistFormData(fd)

    expect(parsed.id).toBe('checklist-1')
    expect(parsed.tipo).toBe('troca')
    expect(parsed.equipe_id).toBe('e1')
    expect(parsed.veiculo_id).toBe('v1')
    expect(parsed.motorista_id).toBe('m1')
    expect(parsed.equipe_destino_id).toBe('e2')
    expect(parsed.motorista_destino_id).toBe('m2')
    expect(parsed.observacoes).toBe('tudo certo')
    expect(parsed.latitude).toBe(-23.5)
    expect(parsed.longitude).toBe(-46.6)
    expect(parsed.avaria_identificada).toBe(true)
    expect(parsed.avaria_descricao).toBe('arranhão na porta')
    expect(parsed.chave_entregue).toBe(true)
    expect(parsed.cartao_combustivel_entregue).toBe(true)
    expect(parsed.assinatura_motorista).toBe(true)
    expect(parsed.itens.lataria_ok).toBe(true)
    expect(parsed.itens.vidros_ok).toBe(false)
    expect(parsed.itens.pneus_ok).toBeNull()
    expect(parsed.itens_problemas).toEqual({ vidros_ok: 'trinca no para-brisa' })
    expect(parsed.fotos.Frente.path).toBe('checklist-1/Frente-1.jpg')
  })

  it('does not throw when observacoes is absent from FormData (regression for bug #1)', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
    })
    expect(() => parseChecklistFormData(fd)).not.toThrow()
    expect(parseChecklistFormData(fd).observacoes).toBeNull()
  })

  it('treats blank observacoes as null', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
      observacoes: '   ',
    })
    expect(parseChecklistFormData(fd).observacoes).toBeNull()
  })

  it('defaults optional relational fields to null when absent', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
    })
    const parsed = parseChecklistFormData(fd)
    expect(parsed.motorista_id).toBeNull()
    expect(parsed.equipe_destino_id).toBeNull()
    expect(parsed.motorista_destino_id).toBeNull()
    expect(parsed.latitude).toBeNull()
    expect(parsed.longitude).toBeNull()
    expect(parsed.avaria_descricao).toBeNull()
  })

  it('treats missing boolean flags as false', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
    })
    const parsed = parseChecklistFormData(fd)
    expect(parsed.avaria_identificada).toBe(false)
    expect(parsed.chave_entregue).toBe(false)
    expect(parsed.cartao_combustivel_entregue).toBe(false)
  })

  it('treats every unanswered item as null, not false', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
    })
    const parsed = parseChecklistFormData(fd)
    expect(Object.values(parsed.itens).every((v) => v === null)).toBe(true)
  })

  it('defaults itens_problemas and fotos to empty objects when absent or malformed', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
      itens_problemas: 'not json',
    })
    const parsed = parseChecklistFormData(fd)
    expect(parsed.itens_problemas).toEqual({})
    expect(parsed.fotos).toEqual({})
  })
})

describe('validateChecklistInput', () => {
  function baseInput(overrides: Partial<ParsedChecklistInput> = {}): ParsedChecklistInput {
    return {
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      motorista_id: null,
      equipe_destino_id: null,
      motorista_destino_id: null,
      observacoes: null,
      latitude: null,
      longitude: null,
      avaria_identificada: false,
      avaria_descricao: null,
      chave_entregue: false,
      cartao_combustivel_entregue: false,
      assinatura_motorista: true,
      itens: {
        lataria_ok: false,
        vidros_ok: false,
        pneus_ok: false,
        combustivel_ok: false,
        itens_internos_ok: false,
        estepe_ok: false,
        macaco_ok: false,
        triangulo_ok: false,
      },
      itens_problemas: {},
      fotos: {
        Frente: { path: 'checklist-1/Frente-1.jpg', lat: null, lng: null },
        Traseira: { path: 'checklist-1/Traseira-1.jpg', lat: null, lng: null },
        'Lateral Esq.': { path: 'checklist-1/Lateral-Esq.-1.jpg', lat: null, lng: null },
        'Lateral Dir.': { path: 'checklist-1/Lateral-Dir.-1.jpg', lat: null, lng: null },
      },
      ...overrides,
    }
  }

  it('passes for a valid saida checklist', () => {
    expect(validateChecklistInput(baseInput())).toBeNull()
  })

  it('requires id', () => {
    expect(validateChecklistInput(baseInput({ id: '' }))).toBe(
      'Erro interno: identificador do checklist ausente'
    )
  })

  it('requires tipo', () => {
    expect(validateChecklistInput(baseInput({ tipo: '' }))).toBe(
      'Tipo e veículo são obrigatórios'
    )
  })

  it('requires equipe_id', () => {
    expect(validateChecklistInput(baseInput({ equipe_id: null }))).toBe(
      'Equipe é obrigatória para este tipo de checklist'
    )
  })

  it('requires veiculo_id', () => {
    expect(validateChecklistInput(baseInput({ veiculo_id: '' }))).toBe(
      'Tipo e veículo são obrigatórios'
    )
  })

  it('requires equipe_destino_id when tipo is troca', () => {
    expect(
      validateChecklistInput(baseInput({ tipo: 'troca', equipe_destino_id: null }))
    ).toBe('Equipe de destino é obrigatória numa troca')
  })

  it('passes for troca when equipe_destino_id is present', () => {
    expect(
      validateChecklistInput(baseInput({ tipo: 'troca', equipe_destino_id: 'e2' }))
    ).toBeNull()
  })

  it('requires assinatura_motorista', () => {
    expect(validateChecklistInput(baseInput({ assinatura_motorista: false }))).toBe(
      'Confirmação do motorista é obrigatória'
    )
  })

  it('não exige equipe para recebimento', () => {
    const input = baseInput({ tipo: 'recebimento', equipe_id: null, assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('não exige equipe para finalizacao_contrato', () => {
    const input = baseInput({ tipo: 'finalizacao_contrato', equipe_id: null, assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('exige equipe para devolucao', () => {
    const input = baseInput({ tipo: 'devolucao', equipe_id: null, assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBe('Equipe é obrigatória para este tipo de checklist')
  })

  it('aceita devolucao com equipe preenchida', () => {
    const input = baseInput({ tipo: 'devolucao', equipe_id: 'equipe-1', assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('não exige equipe de origem para troca (só equipe_destino_id)', () => {
    const input = baseInput({ tipo: 'troca', equipe_id: null, equipe_destino_id: 'equipe-2', assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('exige os 8 itens respondidos — bloqueia com 1 item ainda não respondido (achado U-02)', () => {
    const input = baseInput({ itens: { ...baseInput().itens, macaco_ok: null } })
    expect(validateChecklistInput(input)).toBe('Todos os 8 itens de verificação devem ser respondidos')
  })

  it('aceita itens todos marcados Problema (false não é "não respondido")', () => {
    const input = baseInput()
    expect(validateChecklistInput(input)).toBeNull()
  })

  it.each(FOTO_POSICOES_OBRIGATORIAS)(
    'exige a foto obrigatória "%s" (achado U-02)',
    (posicaoFaltando) => {
      const fotos = { ...baseInput().fotos }
      delete fotos[posicaoFaltando]
      const input = baseInput({ fotos })
      expect(validateChecklistInput(input)).toBe(`Fotos obrigatórias faltando: ${posicaoFaltando}`)
    }
  )

  it('não exige a foto Interna (opcional)', () => {
    const input = baseInput() // já não tem "Interna" em fotos
    expect(validateChecklistInput(input)).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar e confirmar**

Run: `npx jest app/\(operacoes\)/sofia/checklist/__tests__/_validation.test.ts`
Expected: PASS (todos os testes, incluindo os novos de tri-state e fotos obrigatórias)

- [ ] **Step 4: Commit**

```bash
git add app/\(operacoes\)/sofia/checklist/_validation.ts app/\(operacoes\)/sofia/checklist/__tests__/_validation.test.ts
git commit -m "feat(sofia): checklist tri-state (OK/Problema/não respondido) + 4 fotos obrigatórias (U-02)"
```

---

## Task 6: Helper de upload compartilhado + reescrita de `criarChecklistAction`

**Files:**
- Create: `lib/sofia/uploadFotos.ts`
- Test: `lib/sofia/__tests__/uploadFotos.test.ts`
- Modify: `app/(operacoes)/sofia/checklist/_actions.ts`
- Modify: `app/(operacoes)/sofia/checklist/__tests__/_actions.troca.test.ts`
- Modify: `app/(operacoes)/sofia/checklist/__tests__/_actions.devolucao-finalizacao.test.ts`
- Delete: `app/(operacoes)/sofia/checklist/__tests__/_actions.uploadFoto.test.ts` (testa `uploadFotoAction`, que deixa de existir)

**Interfaces:**
- Produces: `uploadFotos(supabase, bucket: string, prefix: string, fotos: CapturedPhoto[]): Promise<UploadFotosResult>` em `lib/sofia/uploadFotos.ts`; `criarChecklistAction` passa a exigir `id` e `fotos` (JSON) no FormData, não usa mais `.select('id').single()` (o id vem do cliente).
- Consumes: `ParsedChecklistInput`, `validateChecklistInput` (Task 5).

- [ ] **Step 1: Escrever o teste do helper de upload (garante a regra "nenhuma escrita se uma foto falhar")**

```ts
// lib/sofia/__tests__/uploadFotos.test.ts
import { uploadFotos } from '../uploadFotos'

function makeSupabaseMock(uploadImpl: () => Promise<{ error: unknown }>) {
  const upload = jest.fn(uploadImpl)
  return {
    supabase: {
      storage: { from: jest.fn(() => ({ upload })) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    upload,
  }
}

const blob = new Blob(['x'], { type: 'image/jpeg' })

describe('uploadFotos', () => {
  it('returns a storage path + lat/lng per photo when every upload succeeds', async () => {
    const { supabase } = makeSupabaseMock(async () => ({ error: null }))

    const result = await uploadFotos(supabase, 'checklist-fotos', 'checklist-1', [
      { blob, posicao: 'Frente', lat: -23.5, lng: -46.6 },
      { blob, posicao: 'Traseira', lat: null, lng: null },
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.fotos)).toEqual(['Frente', 'Traseira'])
      expect(result.fotos.Frente.lat).toBe(-23.5)
      expect(result.fotos.Frente.path).toContain('checklist-1/Frente-')
    }
  })

  it('fails without returning any path when one upload fails (regression for the write-once guarantee, U-02)', async () => {
    let call = 0
    const { supabase } = makeSupabaseMock(async () => {
      call += 1
      return call === 2 ? { error: { message: 'network error' } } : { error: null }
    })

    const result = await uploadFotos(supabase, 'checklist-fotos', 'checklist-1', [
      { blob, posicao: 'Frente', lat: null, lng: null },
      { blob, posicao: 'Traseira', lat: null, lng: null },
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.falhas).toEqual(['Traseira'])
      expect(result.error).toContain('Traseira')
    }
  })

  it('uses the given bucket and prefix to build the storage path', async () => {
    const { supabase, upload } = makeSupabaseMock(async () => ({ error: null }))

    await uploadFotos(supabase, 'sofia-anexos', 'sinistros/sinistro-9', [
      { blob, posicao: 'Dano 1', lat: null, lng: null },
    ])

    expect(upload).toHaveBeenCalled()
    const [path] = upload.mock.calls[0]
    expect(path).toContain('sinistros/sinistro-9/Dano-1-')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest lib/sofia/__tests__/uploadFotos.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o helper**

```ts
// lib/sofia/uploadFotos.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CapturedPhoto {
  blob: Blob
  posicao: string
  lat: number | null
  lng: number | null
}

export interface FotoUploadInfo {
  path: string
  lat: number | null
  lng: number | null
}

export type UploadFotosResult =
  | { ok: true; fotos: Record<string, FotoUploadInfo> }
  | { ok: false; error: string; falhas: string[] }

/**
 * Sobe todas as fotos capturadas para o storage ANTES do registro (checklist
 * ou sinistro) existir no banco — a ordem inversa da anterior, que criava o
 * registro primeiro e subia as fotos depois, deixando um registro "órfão"
 * sem foto quando o upload falhava (achado U-02 da auditoria). Se qualquer
 * upload falhar, nenhum caminho é retornado — quem chama não deve escrever
 * nada no banco nesse caso.
 */
export async function uploadFotos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  bucket: string,
  prefix: string,
  fotos: CapturedPhoto[]
): Promise<UploadFotosResult> {
  const results = await Promise.all(
    fotos.map(async (foto) => {
      const path = `${prefix}/${foto.posicao.replace(/\s/g, '-')}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from(bucket).upload(path, foto.blob, {
        contentType: 'image/jpeg',
      })
      return { posicao: foto.posicao, path, lat: foto.lat, lng: foto.lng, ok: !error }
    })
  )

  const falhas = results.filter((r) => !r.ok).map((r) => r.posicao)
  if (falhas.length > 0) {
    return {
      ok: false,
      error: `Falha ao enviar foto(s): ${falhas.join(', ')}. Tente novamente.`,
      falhas,
    }
  }

  const fotosMap: Record<string, FotoUploadInfo> = {}
  for (const r of results) fotosMap[r.posicao] = { path: r.path, lat: r.lat, lng: r.lng }
  return { ok: true, fotos: fotosMap }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest lib/sofia/__tests__/uploadFotos.test.ts`
Expected: PASS

- [ ] **Step 5: Reescrever `criarChecklistAction` e remover `uploadFotoAction`**

Em `app/(operacoes)/sofia/checklist/_actions.ts`, trocar o corpo de `criarChecklistAction` (linhas 11-164) e remover `uploadFotoAction`/`UploadFotoResult` (linhas 183-206) por completo:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseChecklistFormData, validateChecklistInput } from './_validation'
import { logAudit } from '@/lib/sofia/auditLog'
import { isAdminEmail } from '@/lib/auth/admins'
import { validarVinculoEquipeUnico } from '@/lib/sofia/veiculos'

type State = { error?: string; success?: boolean; checklistId?: string }

export async function criarChecklistAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const input = parseChecklistFormData(formData)
  const {
    id,
    tipo,
    equipe_id,
    veiculo_id,
    motorista_id,
    equipe_destino_id,
    motorista_destino_id,
    observacoes,
    latitude,
    longitude,
    avaria_identificada,
    avaria_descricao,
    chave_entregue,
    cartao_combustivel_entregue,
    assinatura_motorista,
    itens,
    itens_problemas,
    fotos,
  } = input

  const validationError = validateChecklistInput(input)
  if (validationError) return { error: validationError }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('checklist').insert({
    id,
    tipo,
    equipe_id,
    veiculo_id,
    motorista_id,
    equipe_destino_id,
    motorista_destino_id,
    observacoes,
    latitude,
    longitude,
    created_by: user?.id,
    avaria_identificada,
    avaria_descricao,
    chave_entregue,
    cartao_combustivel_entregue,
    assinatura_motorista,
    itens_problemas,
    ...itens,
  })

  if (error) return { error: 'Erro ao salvar checklist' }

  const fotoRows = Object.entries(fotos).map(([posicao, foto]) => ({
    checklist_id: id,
    storage_path: foto.path,
    posicao,
    latitude: foto.lat,
    longitude: foto.lng,
    tirada_em: new Date().toISOString(),
  }))
  if (fotoRows.length > 0) {
    const { error: fotosError } = await supabase.from('checklist_fotos').insert(fotoRows)
    if (fotosError) {
      return {
        error: 'Checklist salvo, mas as fotos não foram registradas. Contate o suporte.',
        checklistId: id,
      }
    }
  }

  await logAudit('checklists', 'criou', id, `Checklist tipo '${tipo}' criado — veículo ${veiculo_id}`)

  const atribuiEquipe = tipo === 'troca' || (tipo === 'recebimento' && !!equipe_destino_id)

  if (atribuiEquipe) {
    const conflito = await validarVinculoEquipeUnico(supabase, equipe_destino_id as string, veiculo_id)
    if (conflito) {
      return { error: conflito, checklistId: id }
    }

    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: insereError } = await supabase.from('veiculo_responsabilidade_historico').insert({
      veiculo_id,
      equipe_id: equipe_destino_id,
      motorista_id: motorista_destino_id,
      inicio: hoje,
      origem_checklist_id: id,
    })

    const { error: veiculoError } = await supabase
      .from('veiculos')
      .update({ equipe_id: equipe_destino_id })
      .eq('id', veiculo_id)

    const motoristaError = motorista_destino_id
      ? (
          await supabase
            .from('motoristas')
            .update({ equipe_id: equipe_destino_id })
            .eq('id', motorista_destino_id)
        ).error
      : null

    if (fechaError || insereError || veiculoError || motoristaError) {
      return {
        error:
          'Checklist salvo, mas a atribuição de equipe não foi totalmente registrada. Contate o suporte.',
        checklistId: id,
      }
    }

    await logAudit('veiculo_responsabilidade_historico', 'criou', null, `Atribuição de equipe: veículo ${veiculo_id} → equipe ${equipe_destino_id}`)
  } else if (tipo === 'devolucao') {
    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: veiculoError } = await supabase
      .from('veiculos')
      .update({ equipe_id: null })
      .eq('id', veiculo_id)

    if (fechaError || veiculoError) {
      return {
        error: 'Checklist salvo, mas a devolução não foi totalmente registrada. Contate o suporte.',
        checklistId: id,
      }
    }

    await logAudit('veiculos', 'atualizou', veiculo_id, `Devolução registrada — veículo ${veiculo_id} sem equipe`)
  } else if (tipo === 'finalizacao_contrato') {
    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: veiculoError } = await supabase
      .from('veiculos')
      .update({ status: 'inativo', equipe_id: null })
      .eq('id', veiculo_id)

    if (fechaError || veiculoError) {
      return {
        error: 'Checklist salvo, mas a finalização de contrato não foi totalmente registrada. Contate o suporte.',
        checklistId: id,
      }
    }

    await logAudit('veiculos', 'desativou', veiculo_id, `Finalização de contrato registrada via checklist — veículo ${veiculo_id}`)
  }

  revalidatePath('/sofia/checklist')
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/equipes')
  revalidatePath('/sofia/disponibilidade')
  return { success: true, checklistId: id }
}

export async function excluirChecklistAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem excluir checklists' }

  const { error } = await supabase.from('checklist').delete().eq('id', id)
  if (error) return { error: 'Erro ao excluir checklist' }
  revalidatePath('/sofia/checklist')
  return { success: true }
}
```

- [ ] **Step 6: Apagar o teste de `uploadFotoAction` (a função não existe mais)**

```bash
rm "app/(operacoes)/sofia/checklist/__tests__/_actions.uploadFoto.test.ts"
```

- [ ] **Step 7: Atualizar `_actions.troca.test.ts`**

`buildTrocaFormData()` precisa de `id` + itens completos + fotos obrigatórias; as asserções de `checklistId` mudam de "o que o mock do banco devolveu" para "o id que o próprio teste mandou" (já que agora o id vem do cliente, não do `.select().single()`):

```ts
function buildTrocaFormData(): FormData {
  const fd = new FormData()
  const fields: Record<string, string> = {
    id: 'checklist-1',
    tipo: 'troca',
    equipe_id: 'equipe-origem',
    veiculo_id: 'veiculo-1',
    equipe_destino_id: 'equipe-destino',
    motorista_destino_id: '',
    motorista_id: '',
    observacoes: '',
    assinatura_motorista: 'true',
    lataria_ok: 'true',
    vidros_ok: 'true',
    pneus_ok: 'true',
    combustivel_ok: 'true',
    itens_internos_ok: 'true',
    estepe_ok: 'true',
    macaco_ok: 'true',
    triangulo_ok: 'true',
    fotos: JSON.stringify({
      Frente: { path: 'checklist-1/Frente-1.jpg', lat: null, lng: null },
      Traseira: { path: 'checklist-1/Traseira-1.jpg', lat: null, lng: null },
      'Lateral Esq.': { path: 'checklist-1/Lateral-Esq.-1.jpg', lat: null, lng: null },
      'Lateral Dir.': { path: 'checklist-1/Lateral-Dir.-1.jpg', lat: null, lng: null },
    }),
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}
```

`tableResults.checklist` deixa de precisar de `data: { id: ... }` (o insert não usa mais `.select().single()`) — trocar todos os `checklist: { data: { id: 'checklist-1' }, error: null }` nesse arquivo por `checklist: { error: null }`, e trocar as asserções de `result` de `{ success: true, checklistId: 'checklist-1' }` para `{ success: true, checklistId: 'checklist-1' }` (mesmo valor, agora vindo do FormData — nenhuma mudança na asserção em si, só no motivo). O `beforeEach` fica:

```ts
describe('criarChecklistAction — troca de responsável', () => {
  beforeEach(() => {
    callLog = []
    tableResults = {
      checklist: { error: null },
      checklist_fotos: { error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })
```

E adicionar `checklist_fotos: { error: null }` em CADA `beforeEach`/reatribuição de `tableResults` no arquivo (inclusive dentro do teste `'blocks the team handoff...'`, que reatribui `tableResults.veiculos` mas herda os demais do `beforeEach`).

- [ ] **Step 8: Atualizar `_actions.devolucao-finalizacao.test.ts`**

Mesmo ajuste: `buildFormData` ganha `id` + itens completos + fotos; `tableResults.checklist` some do `data`; `checklist_fotos` entra em todo `tableResults`; asserções de `checklistId` passam a usar o `id` que o próprio teste manda.

```ts
function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    id: 'checklist-1',
    veiculo_id: 'veiculo-1',
    equipe_id: '',
    equipe_destino_id: '',
    motorista_destino_id: '',
    motorista_id: '',
    observacoes: '',
    assinatura_motorista: 'true',
    lataria_ok: 'true',
    vidros_ok: 'true',
    pneus_ok: 'true',
    combustivel_ok: 'true',
    itens_internos_ok: 'true',
    estepe_ok: 'true',
    macaco_ok: 'true',
    triangulo_ok: 'true',
    fotos: JSON.stringify({
      Frente: { path: 'checklist-1/Frente-1.jpg', lat: null, lng: null },
      Traseira: { path: 'checklist-1/Traseira-1.jpg', lat: null, lng: null },
      'Lateral Esq.': { path: 'checklist-1/Lateral-Esq.-1.jpg', lat: null, lng: null },
      'Lateral Dir.': { path: 'checklist-1/Lateral-Dir.-1.jpg', lat: null, lng: null },
    }),
  }
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) fd.set(k, v)
  return fd
}

describe('criarChecklistAction — devolucao', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { error: null },
      checklist_fotos: { error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('zera a equipe do veículo e fecha o histórico ao devolver', async () => {
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-1', tipo: 'devolucao', equipe_id: 'equipe-1' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-1' })
  })

  it('surfaces erro se falhar ao zerar a equipe do veículo', async () => {
    tableResults.veiculos = { error: { message: 'falhou' } }
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-1', tipo: 'devolucao', equipe_id: 'equipe-1' }))
    expect(result.error).toBeTruthy()
  })
})

describe('criarChecklistAction — finalizacao_contrato', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { error: null },
      checklist_fotos: { error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('inativa o veículo ao finalizar contrato', async () => {
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-2', tipo: 'finalizacao_contrato' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-2' })
  })
})

describe('criarChecklistAction — recebimento com atribuição de equipe', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { error: null },
      checklist_fotos: { error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('atribui a equipe quando equipe_destino_id vem preenchido', async () => {
    const result = await criarChecklistAction(
      {},
      buildFormData({ id: 'checklist-3', tipo: 'recebimento', equipe_destino_id: 'equipe-2' })
    )
    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
  })

  it('não mexe em equipe/histórico quando equipe_destino_id vem vazio', async () => {
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-3', tipo: 'recebimento' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
  })
})
```

- [ ] **Step 9: Rodar toda a suíte de checklist**

Run: `npx jest app/\(operacoes\)/sofia/checklist lib/sofia/__tests__/uploadFotos.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add lib/sofia/uploadFotos.ts lib/sofia/__tests__/uploadFotos.test.ts app/\(operacoes\)/sofia/checklist/_actions.ts app/\(operacoes\)/sofia/checklist/__tests__/_actions.troca.test.ts app/\(operacoes\)/sofia/checklist/__tests__/_actions.devolucao-finalizacao.test.ts
git rm "app/(operacoes)/sofia/checklist/__tests__/_actions.uploadFoto.test.ts"
git commit -m "feat(sofia): checklist grava registro+fotos juntos, fotos sobem antes de existir (U-02)"
```

---

## Task 7: Formulário de checklist — UI tri-state + upload antes do submit

**Files:**
- Modify: `app/(operacoes)/sofia/checklist/novo/_form.tsx`

**Interfaces:**
- Consumes: `uploadFotos` (Task 6), `FOTO_POSICOES_OBRIGATORIAS`, `FOTO_POSICAO_OPCIONAL` (Task 5), `ChecklistItemStatus` (Task 5).

- [ ] **Step 1: Reescrever o formulário**

```tsx
'use client'
import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarChecklistAction } from '../_actions'
import { FOTO_POSICOES_OBRIGATORIAS, FOTO_POSICAO_OPCIONAL } from '../_validation'
import CameraCapture from '@/components/sofia/CameraCapture'
import { createClient } from '@/lib/supabase/client'
import { uploadFotos, type CapturedPhoto } from '@/lib/sofia/uploadFotos'
import type { Equipe, Veiculo, Motorista } from '@/lib/sofia/types'

const ITENS_CHECKLIST = [
  { key: 'lataria_ok', label: 'Lataria' },
  { key: 'vidros_ok', label: 'Vidros' },
  { key: 'pneus_ok', label: 'Pneus' },
  { key: 'combustivel_ok', label: 'Combustível' },
  { key: 'itens_internos_ok', label: 'Itens internos' },
  { key: 'estepe_ok', label: 'Estepe' },
  { key: 'macaco_ok', label: 'Macaco' },
  { key: 'triangulo_ok', label: 'Triângulo' },
]

const POSICOES_FOTO = [...FOTO_POSICOES_OBRIGATORIAS, FOTO_POSICAO_OPCIONAL]

interface Props {
  equipes: Equipe[]
  veiculos: Veiculo[]
  motoristas: Motorista[]
}

export default function ChecklistForm({ equipes, veiculos, motoristas }: Props) {
  const [state, formAction, isPending] = useActionState(criarChecklistAction, {})
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [checklistId] = useState(() => crypto.randomUUID())
  const [tipo, setTipo] = useState('')
  const [equipeId, setEquipeId] = useState('')
  const [veiculoIdManual, setVeiculoIdManual] = useState('')
  const veiculoExplicito = tipo === 'troca' || tipo === 'recebimento' || tipo === 'finalizacao_contrato'
  const exigeEquipe = tipo === 'saida' || tipo === 'retorno' || tipo === 'devolucao'
  const veiculoDaEquipe = veiculos.find((v) => v.equipe_id === equipeId && v.status === 'ativo')
  const motoristaDaEquipe = motoristas.find((m) => m.equipe_id === equipeId && m.ativo)

  const [itens, setItens] = useState<Record<string, boolean | null>>({})
  const [fotos, setFotos] = useState<CapturedPhoto[]>([])
  const [uploadingFotos, setUploadingFotos] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  if (submitting && (state.error || uploadError)) setSubmitting(false)
  const formInFlight = submitting || isPending || uploadingFotos

  const itensRespondidos = ITENS_CHECKLIST.filter((i) => itens[i.key] !== undefined && itens[i.key] !== null).length
  const fotosObrigatoriasCapturadas = FOTO_POSICOES_OBRIGATORIAS.filter((p) =>
    fotos.some((f) => f.posicao === p)
  ).length
  const anyProblema = Object.values(itens).some((v) => v === false)

  const handleCapture = (blob: Blob, posicao: string, lat: number | null, lng: number | null) => {
    setFotos((prev) => [...prev.filter((f) => f.posicao !== posicao), { blob, posicao, lat, lng }])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)
    setSubmitting(true)

    const fd = new FormData(e.currentTarget)

    setUploadingFotos(true)
    const supabase = createClient()
    const resultado = await uploadFotos(supabase, 'checklist-fotos', checklistId, fotos)
    setUploadingFotos(false)

    if (!resultado.ok) {
      setUploadError(resultado.error)
      setSubmitting(false)
      return
    }

    fd.set('id', checklistId)
    fd.set('fotos', JSON.stringify(resultado.fotos))
    fd.set('avaria_identificada', String(anyProblema || fd.get('avaria_identificada') === 'true'))

    const itensProblemas: Record<string, string> = {}
    for (const item of ITENS_CHECKLIST) {
      if (itens[item.key] === false) {
        itensProblemas[item.key] = ((fd.get(`desc_${item.key}`) as string) || '').trim()
      }
    }
    fd.set('itens_problemas', JSON.stringify(itensProblemas))

    startTransition(() => {
      formAction(fd)
      router.push('/sofia/checklist')
    })
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Novo Checklist</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        Registre a condição do veículo com fotos
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}
        {uploadError && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {uploadError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Tipo *</label>
            <select
              name="tipo"
              required
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              <option value="recebimento">Recebimento (retirada da locadora)</option>
              <option value="saida">Saída</option>
              <option value="retorno">Retorno</option>
              <option value="devolucao">Devolução (fica na empresa)</option>
              <option value="troca">Troca de Responsável</option>
              <option value="finalizacao_contrato">Finalização de Contrato</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">{exigeEquipe ? 'Equipe *' : 'Equipe (opcional)'}</label>
            <select
              name="equipe_id"
              required={exigeEquipe}
              value={equipeId}
              onChange={(e) => setEquipeId(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {equipes
                .filter((e) => e.ativo)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {veiculoExplicito ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Veículo *</label>
            <select
              name="veiculo_id"
              required
              value={veiculoIdManual}
              onChange={(e) => setVeiculoIdManual(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {veiculos
                .filter((v) => v.status !== 'inativo')
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} · {v.modelo}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="veiculo_id" value={veiculoDaEquipe?.id ?? ''} />
        )}
        <input type="hidden" name="motorista_id" value={motoristaDaEquipe?.id ?? ''} />

        {!veiculoExplicito && equipeId && (
          <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
            {veiculoDaEquipe ? (
              <>
                <p className="text-[#94a3b8]">
                  Veículo: <span className="text-white font-mono">{veiculoDaEquipe.placa}</span>
                  {' · '}{veiculoDaEquipe.modelo}
                </p>
                <p className="text-[#4a6080] text-xs mt-0.5">
                  Última KM: <span className="text-amber-400 font-mono">{veiculoDaEquipe.km_atual.toLocaleString('pt-BR')} km</span>
                </p>
              </>
            ) : (
              <p className="text-amber-400 text-xs">Nenhum veículo ativo vinculado a esta equipe</p>
            )}
            {motoristaDaEquipe && (
              <p className="text-[#94a3b8] text-xs mt-1">
                Motorista: <span className="text-white">{motoristaDaEquipe.nome}</span>
              </p>
            )}
          </div>
        )}

        {veiculoExplicito && veiculoIdManual && (() => {
          const v = veiculos.find((vv) => vv.id === veiculoIdManual)
          if (!v) return null
          return (
            <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
              <p className="text-[#94a3b8]">
                Veículo: <span className="text-white font-mono">{v.placa}</span>{' · '}{v.modelo}
              </p>
              <p className="text-[#4a6080] text-xs mt-0.5">
                Última KM: <span className="text-amber-400 font-mono">{v.km_atual.toLocaleString('pt-BR')} km</span>
              </p>
            </div>
          )
        })()}

        {(tipo === 'troca' || tipo === 'recebimento') && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[#f05a28]/40 bg-[#0f1f3d]">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#94a3b8]">
                {tipo === 'troca' ? 'Equipe de destino *' : 'Equipe de destino (opcional)'}
              </label>
              <select
                name="equipe_destino_id"
                required={tipo === 'troca'}
                className="px-3 py-2.5 rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
              >
                <option value="">Selecione</option>
                {equipes
                  .filter((e) => e.ativo)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.codigo}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#94a3b8]">Motorista de destino</label>
              <select
                name="motorista_destino_id"
                className="px-3 py-2.5 rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
              >
                <option value="">Selecione</option>
                {motoristas
                  .filter((m) => m.ativo)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">
            Itens de Verificação <span className="text-[#4a6080]">({itensRespondidos} de {ITENS_CHECKLIST.length})</span>
          </p>
          <div className="flex flex-col gap-2">
            {ITENS_CHECKLIST.map((item) => (
              <div key={item.key} className="rounded-lg border border-[#1e3a5f] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#94a3b8]">{item.label}</span>
                  <div className="flex gap-2 shrink-0">
                    <input type="hidden" name={item.key} value={itens[item.key] === true ? 'true' : itens[item.key] === false ? 'false' : ''} />
                    <button
                      type="button"
                      onClick={() => setItens((prev) => ({ ...prev, [item.key]: true }))}
                      className={`px-3 py-1.5 rounded text-xs font-medium border active:scale-95 transition-[color,background-color,border-color,transform] ${
                        itens[item.key] === true
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-[#1e3a5f] text-[#4a6080] hover:border-green-600 hover:text-green-400'
                      }`}
                    >
                      ✓ OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setItens((prev) => ({ ...prev, [item.key]: false }))}
                      className={`px-3 py-1.5 rounded text-xs font-medium border active:scale-95 transition-[color,background-color,border-color,transform] ${
                        itens[item.key] === false
                          ? 'bg-amber-600 border-amber-600 text-white'
                          : 'border-[#1e3a5f] text-[#4a6080] hover:border-amber-600 hover:text-amber-400'
                      }`}
                    >
                      ⚠ Problema
                    </button>
                  </div>
                </div>
                {itens[item.key] === false && (
                  <textarea
                    name={`desc_${item.key}`}
                    rows={2}
                    required
                    placeholder={`Descreva o problema em ${item.label.toLowerCase()}`}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-[#0f1f3d] border border-amber-800 text-white placeholder-[#4a6080] focus:outline-none focus:border-amber-500 text-sm resize-none"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">
            Fotos do Veículo <span className="text-[#4a6080]">({fotosObrigatoriasCapturadas} de {FOTO_POSICOES_OBRIGATORIAS.length} obrigatórias)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {POSICOES_FOTO.map((posicao) => (
              <CameraCapture key={posicao} posicao={posicao} onCapture={handleCapture} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" name="chave_entregue" value="true" id="chave" className="accent-[#f05a28]" />
          <label htmlFor="chave" className="text-sm text-[#94a3b8]">Chave entregue</label>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="cartao_combustivel_entregue" value="true" id="cartao" className="accent-[#f05a28]" />
          <label htmlFor="cartao" className="text-sm text-[#94a3b8]">Cartão combustível entregue</label>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Avaria identificada (fora dos itens acima)?</label>
          <select
            name="avaria_identificada"
            defaultValue="false"
            disabled={anyProblema}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm disabled:opacity-60"
          >
            <option value="false">Não</option>
            <option value="true">Sim</option>
          </select>
          {anyProblema && (
            <p className="text-amber-400 text-xs">Marcado automaticamente — pelo menos um item foi sinalizado como Problema acima.</p>
          )}
          <textarea
            name="avaria_descricao"
            rows={2}
            placeholder="Descreva avaria fora dos itens de verificação (se houver)"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#1e3a5f]">
          <input type="checkbox" name="assinatura_motorista" value="true" id="assinatura" required className="accent-[#f05a28]" />
          <label htmlFor="assinatura" className="text-sm text-[#94a3b8]">
            Motorista confirma recebimento/devolução nas condições descritas *
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea
            name="observacoes"
            rows={3}
            placeholder="Danos visíveis, comentários..."
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] active:scale-95 transition-[border-color,transform]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={formInFlight || itensRespondidos < ITENS_CHECKLIST.length || fotosObrigatoriasCapturadas < FOTO_POSICOES_OBRIGATORIAS.length}
            className="flex-1 py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
          >
            {uploadingFotos
              ? 'Enviando fotos...'
              : formInFlight
              ? 'Salvando...'
              : 'Finalizar Checklist'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck e suíte completa**

Run: `npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/\(operacoes\)/sofia/checklist/novo/_form.tsx
git commit -m "feat(sofia): formulário de checklist com itens tri-state e upload antes do submit (U-02)"
```

---

## Task 8: Componente `GaleriaFotos`

**Files:**
- Create: `components/sofia/GaleriaFotos.tsx`
- Test: `components/sofia/__tests__/GaleriaFotos.test.tsx`

**Interfaces:**
- Produces: `GaleriaFotos({ fotos: FotoItem[] })`, `FotoItem = { id: string; url: string; label?: string }`.

- [ ] **Step 1: Escrever o teste**

```tsx
// components/sofia/__tests__/GaleriaFotos.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import GaleriaFotos from '../GaleriaFotos'

describe('GaleriaFotos', () => {
  it('mostra uma mensagem quando não há fotos', () => {
    render(<GaleriaFotos fotos={[]} />)
    expect(screen.getByText(/nenhuma foto/i)).toBeInTheDocument()
  })

  it('renderiza uma miniatura por foto', () => {
    render(
      <GaleriaFotos
        fotos={[
          { id: '1', url: 'https://example.com/frente.jpg', label: 'Frente' },
          { id: '2', url: 'https://example.com/traseira.jpg', label: 'Traseira' },
        ]}
      />
    )
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByAltText('Frente')).toBeInTheDocument()
    expect(screen.getByAltText('Traseira')).toBeInTheDocument()
  })

  it('abre a foto em tela cheia ao clicar na miniatura, e fecha ao clicar de novo', () => {
    render(<GaleriaFotos fotos={[{ id: '1', url: 'https://example.com/frente.jpg', label: 'Frente' }]} />)

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getAllByAltText('Frente')).toHaveLength(2) // miniatura + versão ampliada

    fireEvent.click(screen.getAllByAltText('Frente')[1])
    expect(screen.getAllByAltText('Frente')).toHaveLength(1) // fechou, só a miniatura sobra
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest components/sofia/__tests__/GaleriaFotos.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```tsx
// components/sofia/GaleriaFotos.tsx
'use client'
import { useState } from 'react'

export interface FotoItem {
  id: string
  url: string
  label?: string
}

/**
 * Grade de miniaturas com ampliação em tela cheia. Reutilizada no detalhe do
 * checklist e do sinistro (achado U-03 — fotos capturadas nunca eram
 * exibidas em lugar nenhum, write-only).
 */
export default function GaleriaFotos({ fotos }: { fotos: FotoItem[] }) {
  const [ampliada, setAmpliada] = useState<FotoItem | null>(null)

  if (fotos.length === 0) {
    return <p className="text-[#4a6080] text-sm">Nenhuma foto anexada.</p>
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {fotos.map((foto) => (
          <button
            key={foto.id}
            type="button"
            onClick={() => setAmpliada(foto)}
            className="relative rounded-lg overflow-hidden border border-[#1e3a5f] active:scale-95 transition-transform"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.url} alt={foto.label ?? 'Foto'} className="w-full h-28 object-cover" />
            {foto.label && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                {foto.label}
              </span>
            )}
          </button>
        ))}
      </div>

      {ampliada && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setAmpliada(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ampliada.url} alt={ampliada.label ?? 'Foto'} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest components/sofia/__tests__/GaleriaFotos.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/sofia/GaleriaFotos.tsx components/sofia/__tests__/GaleriaFotos.test.tsx
git commit -m "feat(sofia): GaleriaFotos — grade com ampliação em tela cheia (U-03)"
```

---

## Task 9: Tela de detalhe do checklist + link na listagem

**Files:**
- Create: `app/(operacoes)/sofia/checklist/[id]/page.tsx`
- Modify: `app/(operacoes)/sofia/checklist/page.tsx`
- Modify: `components/sofia/Sidebar.tsx:56-60`

**Interfaces:**
- Consumes: `GaleriaFotos`, `FotoItem` (Task 8); `badgeChecklist` (já existe).

- [ ] **Step 1: Criar a página de detalhe**

```tsx
// app/(operacoes)/sofia/checklist/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { badgeChecklist } from '@/lib/sofia/checklistBadge'
import GaleriaFotos, { type FotoItem } from '@/components/sofia/GaleriaFotos'

const ITENS_LABELS: Record<string, string> = {
  lataria_ok: 'Lataria',
  vidros_ok: 'Vidros',
  pneus_ok: 'Pneus',
  combustivel_ok: 'Combustível',
  itens_internos_ok: 'Itens internos',
  estepe_ok: 'Estepe',
  macaco_ok: 'Macaco',
  triangulo_ok: 'Triângulo',
}

export default async function ChecklistDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: checklist }, { data: fotos }] = await Promise.all([
    supabase.from('checklist').select('*, equipes(codigo), veiculos(placa, modelo), motoristas(nome)').eq('id', id).single(),
    supabase.from('checklist_fotos').select('*').eq('checklist_id', id),
  ])

  if (!checklist) notFound()

  const paths = (fotos ?? []).map((f) => f.storage_path)
  const { data: signed } =
    paths.length > 0
      ? await supabase.storage.from('checklist-fotos').createSignedUrls(paths, 60)
      : { data: [] }

  const fotoItems: FotoItem[] = (fotos ?? [])
    .map((f) => {
      const s = (signed ?? []).find((s) => s.path === f.storage_path)
      return { id: f.id as string, url: s?.signedUrl ?? '', label: (f.posicao as string | null) ?? undefined }
    })
    .filter((f) => f.url)

  const badge = badgeChecklist(checklist.tipo)
  const itemKeys = Object.keys(ITENS_LABELS)
  const problemas = (checklist.itens_problemas as Record<string, string> | null) ?? {}

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <span className={`px-2.5 py-1 rounded text-xs font-bold ${badge.style}`}>{badge.label}</span>
        <h1 className="text-2xl font-bold text-white font-mono">{checklist.veiculos?.placa ?? 'Sem veículo'}</h1>
      </div>
      <p className="text-[#4a6080] text-sm mb-8">
        {checklist.equipes?.codigo ?? '—'} · {checklist.motoristas?.nome ?? 'Motorista não informado'} ·{' '}
        {new Date(checklist.created_at).toLocaleString('pt-BR')}
      </p>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Fotos</h2>
      <div className="mb-8">
        <GaleriaFotos fotos={fotoItems} />
      </div>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Itens verificados</h2>
      <div className="flex flex-col gap-2 mb-8">
        {itemKeys.map((key) => {
          const status = checklist[key] as boolean | null
          const descricao = problemas[key]
          return (
            <div key={key} className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border border-[#1e3a5f]">
              <span className="text-sm text-[#94a3b8]">{ITENS_LABELS[key]}</span>
              <div className="text-right">
                <span
                  className={`text-xs font-bold ${
                    status === true ? 'text-green-400' : status === false ? 'text-amber-400' : 'text-[#4a6080]'
                  }`}
                >
                  {status === true ? '✓ OK' : status === false ? '⚠ Problema' : '— Não respondido'}
                </span>
                {descricao && <p className="text-[#4a6080] text-xs mt-1 max-w-xs">{descricao}</p>}
              </div>
            </div>
          )
        })}
      </div>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Registro</h2>
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4 flex flex-col gap-1.5 text-sm">
        <p className="text-[#94a3b8]">Chave entregue: <span className="text-white">{checklist.chave_entregue ? 'Sim' : 'Não'}</span></p>
        <p className="text-[#94a3b8]">Cartão combustível entregue: <span className="text-white">{checklist.cartao_combustivel_entregue ? 'Sim' : 'Não'}</span></p>
        <p className="text-[#94a3b8]">Assinatura do motorista: <span className="text-white">{checklist.assinatura_motorista ? 'Confirmada' : 'Não confirmada'}</span></p>
        {checklist.avaria_identificada && (
          <p className="text-amber-400">Avaria identificada: {checklist.avaria_descricao ?? '—'}</p>
        )}
        {checklist.observacoes && (
          <p className="text-[#94a3b8]">Observações: <span className="text-white">{checklist.observacoes}</span></p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Cada linha da listagem vira link, exclusão fora do link**

Em `app/(operacoes)/sofia/checklist/page.tsx`, trocar o `<div key={c.id} className="flex items-center gap-4 ...">` (linhas 43-70) por:

```tsx
          <div
            key={c.id}
            className="flex items-center gap-4 px-4 py-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050]"
          >
            <Link href={`/sofia/checklist/${c.id}`} className="flex items-center gap-4 flex-1 min-w-0">
              <span className={`px-2.5 py-1 rounded text-xs font-bold shrink-0 ${badge.style}`}>
                {badge.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium">
                  {c.equipes?.codigo} · {c.veiculos?.placa}
                </p>
                <p className="text-[#4a6080] text-xs truncate">
                  {c.motoristas?.nome ?? 'Motorista não informado'}
                </p>
              </div>
              <p className="text-[#4a6080] text-xs shrink-0">
                {new Date(c.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </Link>
            <div className="shrink-0">
              <DeleteConfirmButton action={excluirChecklistAction} id={c.id} itemLabel={`checklist de ${c.motoristas?.nome ?? 'motorista não informado'} (${new Date(c.created_at).toLocaleDateString('pt-BR')})`} />
            </div>
          </div>
```

- [ ] **Step 3: Registrar a rota no Sidebar (route-integrity test)**

Em `components/sofia/Sidebar.tsx:56-60`:

```ts
export const detailRoutes = [
  '/sofia/veiculos/[id]',
  '/sofia/motoristas/[id]',
  '/sofia/sinistros/[id]',
  '/sofia/checklist/[id]',
]
```

- [ ] **Step 4: Rodar a suíte + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (`Sidebar.test.ts` confirma que `app/(operacoes)/sofia/checklist/[id]/page.tsx` existe)

- [ ] **Step 5: Commit**

```bash
git add app/\(operacoes\)/sofia/checklist/\[id\]/page.tsx app/\(operacoes\)/sofia/checklist/page.tsx components/sofia/Sidebar.tsx
git commit -m "feat(sofia): tela de detalhe do checklist exibe fotos e itens (U-03)"
```

---

## Task 10: Sinistro — mesma inversão de ordem (fotos opcionais)

**Files:**
- Modify: `app/(operacoes)/sofia/sinistros/_actions.ts`
- Modify: `app/(operacoes)/sofia/sinistros/novo/_form.tsx`
- Create: `app/(operacoes)/sofia/sinistros/__tests__/_actions.criar.test.ts`

**Interfaces:**
- Consumes: `uploadFotos` (Task 6).

- [ ] **Step 1: Escrever o teste de `criarSinistroAction` (não existia teste pra essa função)**

```ts
// app/(operacoes)/sofia/sinistros/__tests__/_actions.criar.test.ts
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['insert', 'select', 'eq', 'single']
  for (const m of methods) chain[m] = jest.fn(() => chain)
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { criarSinistroAction } from '../_actions'

function buildFormData(fields: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    id: 'sinistro-1',
    veiculo_id: 'veiculo-1',
    motorista_id: '',
    data: '2026-07-27',
    tipo: 'avaria',
    descricao: 'Arranhão na lateral',
    valor_dano: '',
    observacoes: '',
    fotos: '{}',
  }
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) fd.set(k, v)
  return fd
}

describe('criarSinistroAction', () => {
  beforeEach(() => {
    tableResults = {
      sinistros: { error: null },
      sinistro_fotos: { error: null },
    }
  })

  it('cria o sinistro usando o id vindo do formulário', async () => {
    const result = await criarSinistroAction({}, buildFormData())
    expect(result).toEqual({ success: true, sinistroId: 'sinistro-1' })
  })

  it('grava as linhas de foto quando o mapa de fotos vem preenchido', async () => {
    const fd = buildFormData({
      fotos: JSON.stringify({ 'Dano 1': 'sinistros/sinistro-1/dano1.jpg' }),
    })
    const result = await criarSinistroAction({}, fd)
    expect(result).toEqual({ success: true, sinistroId: 'sinistro-1' })
  })

  it('surfaces erro (mas mantém o sinistro salvo) se a gravação das fotos falhar', async () => {
    tableResults.sinistro_fotos = { error: { message: 'RLS denied' } }
    const fd = buildFormData({
      fotos: JSON.stringify({ 'Dano 1': 'sinistros/sinistro-1/dano1.jpg' }),
    })
    const result = await criarSinistroAction({}, fd)
    expect(result.error).toBeTruthy()
    expect(result.sinistroId).toBe('sinistro-1')
  })

  it('exige data, tipo e descrição', async () => {
    const result = await criarSinistroAction({}, buildFormData({ descricao: '' }))
    expect(result).toEqual({ error: 'Data, tipo e descrição são obrigatórios' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/\(operacoes\)/sofia/sinistros/__tests__/_actions.criar.test.ts`
Expected: FAIL — `criarSinistroAction` ainda não lê `id`/`fotos` do FormData.

- [ ] **Step 3: Reescrever `criarSinistroAction`, remover `uploadFotoSinistroAction`**

Em `app/(operacoes)/sofia/sinistros/_actions.ts`, trocar `criarSinistroAction` e `uploadFotoSinistroAction` (linhas 29-59) por:

```ts
export async function criarSinistroAction(_prev: State, formData: FormData): Promise<State> {
  const id = (formData.get('id') as string) || ''
  const veiculo_id = (formData.get('veiculo_id') as string) || null
  const motorista_id = (formData.get('motorista_id') as string) || null
  const data = formData.get('data') as string
  const tipo = formData.get('tipo') as string
  const descricao = (formData.get('descricao') as string).trim()
  const valor_dano = formData.get('valor_dano') ? Number(formData.get('valor_dano')) : null
  const observacoes = (formData.get('observacoes') as string).trim() || null

  let fotos: Record<string, string> = {}
  try {
    fotos = JSON.parse((formData.get('fotos') as string | null) || '{}')
  } catch {
    fotos = {}
  }

  if (!data || !tipo || !descricao) return { error: 'Data, tipo e descrição são obrigatórios' }
  if (!id) return { error: 'Erro interno: identificador do sinistro ausente' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sinistros')
    .insert({ id, veiculo_id, motorista_id, data, tipo, descricao, valor_dano, observacoes })

  if (error) return { error: 'Erro ao registrar sinistro' }

  const fotoRows = Object.values(fotos).map((storage_path) => ({ sinistro_id: id, storage_path }))
  if (fotoRows.length > 0) {
    const { error: fotosError } = await supabase.from('sinistro_fotos').insert(fotoRows)
    if (fotosError) {
      revalidatePath('/sofia/sinistros')
      return { error: 'Sinistro salvo, mas as fotos não foram registradas. Contate o suporte.', sinistroId: id }
    }
  }

  revalidatePath('/sofia/sinistros')
  return { success: true, sinistroId: id }
}
```

(As demais funções do arquivo — `atualizarAutorizacaoSinistroAction`, `atualizarTratativaSinistroAction`, `excluirSinistroAction` — ficam como estão.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/\(operacoes\)/sofia/sinistros/__tests__/_actions.criar.test.ts app/\(operacoes\)/sofia/sinistros/__tests__/_actions.test.ts`
Expected: PASS

- [ ] **Step 5: Reescrever o formulário de sinistro**

```tsx
// app/(operacoes)/sofia/sinistros/novo/_form.tsx
'use client'
import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarSinistroAction } from '../_actions'
import CameraCapture from '@/components/sofia/CameraCapture'
import { createClient } from '@/lib/supabase/client'
import { uploadFotos, type CapturedPhoto } from '@/lib/sofia/uploadFotos'
import { useVeiculoMotoristaCascade } from '@/lib/sofia/useVeiculoMotoristaCascade'
import type { Veiculo, Motorista } from '@/lib/sofia/types'

export default function NovoSinistroForm({
  veiculos,
  motoristas,
}: {
  veiculos: Veiculo[]
  motoristas: Motorista[]
}) {
  const [state, formAction, isPending] = useActionState(criarSinistroAction, {})
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [sinistroId] = useState(() => crypto.randomUUID())
  const [fotos, setFotos] = useState<CapturedPhoto[]>([])
  const [uploadingFotos, setUploadingFotos] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { veiculoId, motoristaId, onVeiculoChange, onMotoristaChange } = useVeiculoMotoristaCascade()
  const [submitting, setSubmitting] = useState(false)
  if (submitting && (state.error || uploadError)) setSubmitting(false)
  const formInFlight = submitting || isPending || uploadingFotos

  const handleCapture = (blob: Blob, posicao: string) => {
    setFotos((prev) => [...prev.filter((f) => f.posicao !== posicao), { blob, posicao, lat: null, lng: null }])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)
    setSubmitting(true)

    const fd = new FormData(e.currentTarget)
    fd.set('id', sinistroId)

    if (fotos.length > 0) {
      setUploadingFotos(true)
      const supabase = createClient()
      const resultado = await uploadFotos(supabase, 'sofia-anexos', `sinistros/${sinistroId}`, fotos)
      setUploadingFotos(false)

      if (!resultado.ok) {
        setUploadError(resultado.error)
        setSubmitting(false)
        return
      }
      const paths: Record<string, string> = {}
      for (const [posicao, info] of Object.entries(resultado.fotos)) paths[posicao] = info.path
      fd.set('fotos', JSON.stringify(paths))
    } else {
      fd.set('fotos', '{}')
    }

    startTransition(() => {
      formAction(fd)
      router.push('/sofia/sinistros')
    })
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar Sinistro</h1>
      <p className="text-[#4a6080] text-sm mb-8">Batida, furto ou avaria — com fotos do dano</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}
        {uploadError && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {uploadError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Veículo</label>
            <select
              name="veiculo_id"
              value={veiculoId}
              onChange={(e) => onVeiculoChange(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Motorista</label>
            <select
              name="motorista_id"
              value={motoristaId}
              onChange={(e) => onMotoristaChange(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Data *</label>
            <input name="data" type="date" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Tipo *</label>
            <select name="tipo" required defaultValue="avaria" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
              <option value="colisao">Colisão</option>
              <option value="furto">Furto</option>
              <option value="avaria">Avaria</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Descrição *</label>
          <textarea name="descricao" required rows={3} placeholder="O que aconteceu" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor estimado do dano (R$)</label>
          <input name="valor_dano" type="number" step="0.01" placeholder="0.00" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">Fotos do dano <span className="text-[#4a6080]">(câmera ao vivo)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CameraCapture posicao="Dano 1" onCapture={handleCapture} />
            <CameraCapture posicao="Dano 2" onCapture={handleCapture} />
          </div>
          {fotos.length > 0 && (
            <p className="text-xs text-green-400 mt-2">{fotos.length} foto{fotos.length > 1 ? 's' : ''} capturada{fotos.length > 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea name="observacoes" rows={2} className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] active:scale-95 transition-[border-color,transform]">
            Cancelar
          </button>
          <button type="submit" disabled={formInFlight} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95">
            {uploadingFotos ? 'Enviando fotos...' : formInFlight ? 'Salvando...' : 'Registrar Sinistro'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck e suíte completa de sinistros**

Run: `npx tsc --noEmit && npx jest app/\(operacoes\)/sofia/sinistros`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/\(operacoes\)/sofia/sinistros/_actions.ts app/\(operacoes\)/sofia/sinistros/novo/_form.tsx app/\(operacoes\)/sofia/sinistros/__tests__/_actions.criar.test.ts
git commit -m "feat(sofia): sinistro sobe fotos antes de existir, mesmo padrão do checklist (U-02)"
```

---

## Task 11: Detalhe do sinistro exibe as fotos

**Files:**
- Modify: `app/(operacoes)/sofia/sinistros/[id]/page.tsx`

**Interfaces:**
- Consumes: `GaleriaFotos`, `FotoItem` (Task 8).

- [ ] **Step 1: Trocar o texto "N foto(s) anexada(s)" pela galeria**

Em `app/(operacoes)/sofia/sinistros/[id]/page.tsx`, trocar o bloco de fotos (linhas 26-31) e importar `GaleriaFotos`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TratativaForm from './_form'
import GaleriaFotos, { type FotoItem } from '@/components/sofia/GaleriaFotos'

export default async function SinistroDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: sinistro }, { data: fotos }] = await Promise.all([
    supabase.from('sinistros').select('*, veiculos(placa, modelo), motoristas(nome)').eq('id', id).single(),
    supabase.from('sinistro_fotos').select('*').eq('sinistro_id', id),
  ])

  if (!sinistro) notFound()

  const paths = (fotos ?? []).map((f) => f.storage_path)
  const { data: signed } =
    paths.length > 0
      ? await supabase.storage.from('sofia-anexos').createSignedUrls(paths, 60)
      : { data: [] }

  const fotoItems: FotoItem[] = (fotos ?? [])
    .map((f) => {
      const s = (signed ?? []).find((s) => s.path === f.storage_path)
      return { id: f.id as string, url: s?.signedUrl ?? '' }
    })
    .filter((f) => f.url)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{sinistro.veiculos?.placa ?? 'Sem veículo'}</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          {new Date(sinistro.data).toLocaleDateString('pt-BR')} · {sinistro.motoristas?.nome ?? 'sem motorista'}
        </p>
      </div>

      <p className="text-white text-sm mb-6">{sinistro.descricao}</p>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Fotos</h2>
      <div className="mb-8">
        <GaleriaFotos fotos={fotoItems} />
      </div>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Tratativa</h2>
      <TratativaForm sinistro={sinistro} />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/\(operacoes\)/sofia/sinistros/\[id\]/page.tsx
git commit -m "feat(sofia): detalhe do sinistro exibe fotos em galeria (U-03)"
```

---

## Task 12: Documentos — upload opcional de arquivo

**Files:**
- Modify: `app/(operacoes)/sofia/documentos/_actions.ts`
- Modify: `app/(operacoes)/sofia/documentos/novo/_form.tsx`
- Modify: `app/(operacoes)/sofia/documentos/page.tsx`
- Create: `components/sofia/VerArquivoButton.tsx`

**Interfaces:**
- Produces: `obterUrlDocumentoAction(storagePath: string): Promise<{ url: string } | { error: string }>`.
- Consumes: `DOCUMENTO_TIPOS`, `DOCUMENTO_TIPO_LABELS` (Task 2), `isValidEnum` (já existe em `lib/sofia/enums.ts`).

`documentos_veiculo.storage_path` já existe no schema (nullable) e o bucket `sofia-anexos` já tem policy de upload/leitura autenticada — nenhuma migração SQL nesta task.

- [ ] **Step 1: `criarDocumentoAction` aceita `storage_path` opcional + valida o tipo**

Em `app/(operacoes)/sofia/documentos/_actions.ts`:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { DOCUMENTO_TIPOS, isValidEnum } from '@/lib/sofia/enums'

type State = { error?: string; success?: boolean }

export async function criarDocumentoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const tipo = formData.get('tipo') as string
  const numero = (formData.get('numero') as string).trim() || null
  const vencimento = formData.get('vencimento') as string
  const storage_path = (formData.get('storage_path') as string | null) || null

  if (!veiculo_id || !tipo || !vencimento) return { error: 'Veículo, tipo e vencimento são obrigatórios' }
  if (!isValidEnum(DOCUMENTO_TIPOS, tipo)) return { error: 'Tipo de documento inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('documentos_veiculo').insert({ veiculo_id, tipo, numero, vencimento, storage_path })

  if (error) return { error: 'Erro ao registrar documento' }
  revalidatePath('/sofia/documentos')
  return { success: true }
}

export async function obterUrlDocumentoAction(storagePath: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }

  const { data, error } = await supabase.storage.from('sofia-anexos').createSignedUrl(storagePath, 60)
  if (error || !data) return { error: 'Erro ao gerar link do arquivo' }
  return { url: data.signedUrl }
}
```

- [ ] **Step 2: Formulário ganha o campo de arquivo, opcional, upload cliente-side antes do submit**

```tsx
// app/(operacoes)/sofia/documentos/novo/_form.tsx
'use client'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarDocumentoAction } from '../_actions'
import { createClient } from '@/lib/supabase/client'
import { DOCUMENTO_TIPOS, DOCUMENTO_TIPO_LABELS } from '@/lib/sofia/enums'
import { comprimirImagem } from '@/lib/sofia/comprimirImagem'
import type { Veiculo } from '@/lib/sofia/types'

export default function NovoDocumentoForm({ veiculos }: { veiculos: Veiculo[] }) {
  const [state, formAction, isPending] = useActionState(criarDocumentoAction, {})
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (state.success) router.push('/sofia/documentos')
  }, [state.success, router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)
    const fd = new FormData(e.currentTarget)
    const arquivo = fd.get('arquivo') as File | null

    if (arquivo && arquivo.size > 0) {
      setUploading(true)
      const supabase = createClient()
      const paraEnviar = arquivo.type.startsWith('image/') ? await comprimirImagem(arquivo) : arquivo
      const path = `documentos/${crypto.randomUUID()}-${arquivo.name}`
      const { error } = await supabase.storage.from('sofia-anexos').upload(path, paraEnviar, {
        contentType: arquivo.type,
      })
      setUploading(false)
      if (error) {
        setUploadError('Falha ao enviar o arquivo. Tente novamente.')
        return
      }
      fd.set('storage_path', path)
    }
    fd.delete('arquivo')

    startTransition(() => { formAction(fd) })
  }

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Adicionar Documento</h1>
      <p className="text-[#4a6080] text-sm mb-8">Seguro, licenciamento, IPVA, contrato de locação ou outro</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}
        {uploadError && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {uploadError}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Veículo *</label>
          <select name="veiculo_id" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="">Selecione</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Tipo *</label>
          <select name="tipo" required defaultValue="seguro" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            {DOCUMENTO_TIPOS.map((t) => (
              <option key={t} value={t}>{DOCUMENTO_TIPO_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Número/Apólice</label>
          <input name="numero" placeholder="Número do documento" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Vencimento *</label>
          <input name="vencimento" type="date" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Arquivo (opcional)</label>
          <input
            name="arquivo"
            type="file"
            accept="application/pdf,image/*"
            className="text-sm text-[#94a3b8] file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#f05a28] file:text-white file:text-sm file:cursor-pointer"
          />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] active:scale-95 transition-[border-color,transform]">
            Cancelar
          </button>
          <button type="submit" disabled={isPending || uploading} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95">
            {uploading ? 'Enviando arquivo...' : isPending ? 'Salvando...' : 'Adicionar Documento'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Botão "Ver arquivo" reutilizável**

```tsx
// components/sofia/VerArquivoButton.tsx
'use client'
import { useState } from 'react'
import { obterUrlDocumentoAction } from '@/app/(operacoes)/sofia/documentos/_actions'

export default function VerArquivoButton({ storagePath }: { storagePath: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const result = await obterUrlDocumentoAction(storagePath)
    setLoading(false)
    if ('url' in result) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-[#f05a28] hover:underline disabled:opacity-50 active:scale-95 transition-transform"
    >
      {loading ? '...' : 'Ver arquivo'}
    </button>
  )
}
```

- [ ] **Step 4: Listagem mostra "Ver arquivo" ou "sem arquivo"**

Em `app/(operacoes)/sofia/documentos/page.tsx`, adicionar uma coluna "Arquivo" à tabela. Importar `VerArquivoButton`, e no `<thead>` (depois de "Status", linha 140) adicionar:

```tsx
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Arquivo</th>
```

No `<tbody>`, depois da célula de status (linhas 153-157), adicionar:

```tsx
                <td className="px-4 py-3">
                  {d.storage_path ? (
                    <VerArquivoButton storagePath={d.storage_path} />
                  ) : (
                    <span className="text-[#4a6080] text-xs">sem arquivo</span>
                  )}
                </td>
```

E atualizar o `colSpan` da linha "Nenhum documento encontrado" (linha 162) de `5` para `6`.

- [ ] **Step 5: Typecheck + suíte completa**

Run: `npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/\(operacoes\)/sofia/documentos/_actions.ts app/\(operacoes\)/sofia/documentos/novo/_form.tsx app/\(operacoes\)/sofia/documentos/page.tsx components/sofia/VerArquivoButton.tsx
git commit -m "feat(sofia): upload opcional de arquivo em Documentos (U-05)"
```

---

## Task 13: Veículos — indicador visual permanente no link da placa

**Files:**
- Modify: `app/(operacoes)/sofia/veiculos/page.tsx:115-119`

**Interfaces:** nenhuma (mudança puramente visual).

- [ ] **Step 1: Trocar o link da placa**

Em `app/(operacoes)/sofia/veiculos/page.tsx`, trocar (linhas 115-119):

```tsx
                  <td className="px-4 py-3 text-white font-medium font-mono">
                    <Link href={`/sofia/veiculos/${v.id}`} className="hover:text-[#f05a28] transition-colors">
                      {v.placa}
                    </Link>
                  </td>
```

por:

```tsx
                  <td className="px-4 py-3 text-white font-medium font-mono">
                    <Link
                      href={`/sofia/veiculos/${v.id}`}
                      className="inline-flex items-center gap-1.5 hover:text-[#f05a28] transition-colors"
                    >
                      {v.placa}
                      <span className="text-[#4a6080] text-xs" aria-hidden="true">→</span>
                    </Link>
                  </td>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/\(operacoes\)/sofia/veiculos/page.tsx
git commit -m "feat(sofia): indicador visual permanente no link do histórico do veículo (fecha item 1 do feedback do cliente)"
```

---

## Verificação final (rodar antes de considerar o Track B pronto pra review)

```bash
npx tsc --noEmit
npx jest
npx next build
```

Expected: typecheck limpo, toda a suíte passando (baseline conhecida antes desta spec: 247/247 — ver [[gestao-frotas-v04]] — mais os testes novos desta spec), build de produção limpo.

**SQL pra João rodar manualmente no Supabase Dashboard (projeto `iyytcavcgukfjnjjrerx`), antes do deploy do código desta spec:**
- `sdd-sql-track-b.sql` (Task 1) — uma única coluna nova, sem dependência de outra migração pendente.

**Fora de escopo, fica pra depois (confirmado no brainstorming da spec):** agendamento/notificação de revisões; vínculo entre "Contrato de locação" e `km_contratual_mensal`; Tracks C (perf/paginação/índices, gera SQL novo) e D (dark-only sob sol, alvos de toque mobile).
