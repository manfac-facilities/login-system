/**
 * Camadas, regras e carimbo da prancha de faseamento (Leva 6b §2 itens 5-7).
 *
 * Coordenadas RELATIVAS à planta (0 a 1, x da esquerda, y de cima), como o mapa
 * da Leva 6. Sem dependência nova: `zod` está só transitivo no lockfile, então os
 * schemas abaixo têm a mesma forma (`safeParse` -> `{success, data | error}`) e
 * podem ser trocados por zod sem mexer em quem chama.
 */

export const MAX_CAMADAS = 300
export const MAX_PONTOS = 50
export const MAX_ROTULO = 120
const EPS = 1e-6
export const MAX_REGRAS = 12
export const MAX_TEXTO_REGRA = 200
export const MAX_TEXTO_CARIMBO = 300

export type GrupoCamada = 'zona' | 'linha' | 'porta' | 'fluxo' | 'icone'

/** Tipos, na ordem fixa da legenda (a mesma do mockup aprovado). */
export const TIPOS = {
  zona_obra: { nome: 'Zona de obra', grupo: 'zona', cor: '#f6d2c4' },
  zona_salao: { nome: 'Salão em operação', grupo: 'zona', cor: '#d7e8f7' },
  zona_atend: { nome: 'Atendimento', grupo: 'zona', cor: '#e3f1e2' },
  zona_uso: { nome: 'Área em uso', grupo: 'zona', cor: '#efe7d4' },
  restrita: { nome: 'Circulação restrita', grupo: 'zona', cor: '#fde9e1' },
  drywall: { nome: 'Drywall piso a teto', grupo: 'linha', cor: '#0d2050' },
  balcao: { nome: 'Balcão fechado', grupo: 'linha', cor: '#6b4a2b' },
  porta_obra: { nome: 'Nova porta (acesso exclusivo da obra)', grupo: 'porta', cor: '#e0531f' },
  porta_exist: { nome: 'Entrada existente', grupo: 'porta', cor: '#1f6fd1' },
  fluxo_cli: { nome: 'Fluxo de clientes e equipe da loja', grupo: 'fluxo', cor: '#1f6fd1' },
  fluxo_obra: { nome: 'Fluxo da obra (equipe, material, entulho)', grupo: 'fluxo', cor: '#e0531f' },
  extintor: { nome: 'Extintor', grupo: 'icone', cor: '#b42318' },
  emerg: { nome: 'Luminária de emergência', grupo: 'icone', cor: '#17803d' },
} as const satisfies Record<string, { nome: string; grupo: GrupoCamada; cor: string }>

export type TipoCamada = keyof typeof TIPOS

export type Ponto = [number, number]
type TipoDe<G extends GrupoCamada> = { [K in TipoCamada]: (typeof TIPOS)[K]['grupo'] extends G ? K : never }[TipoCamada]

export type CamadaZona = { id: string; t: TipoDe<'zona'>; r: [number, number, number, number]; rot?: string; oculta?: boolean }
export type CamadaLinha = { id: string; t: TipoDe<'linha' | 'fluxo'>; p: Ponto[]; oculta?: boolean }
export type CamadaPonto = { id: string; t: TipoDe<'porta' | 'icone'>; at: Ponto; oculta?: boolean }
export type Camada = CamadaZona | CamadaLinha | CamadaPonto

export type ResultadoSchema<T> = { success: true; data: T } | { success: false; error: { message: string } }
export type Schema<T> = { safeParse: (v: unknown) => ResultadoSchema<T>; parse: (v: unknown) => T }

function criarSchema<T>(validar: (v: unknown) => string | { data: T }): Schema<T> {
  const safeParse = (v: unknown): ResultadoSchema<T> => {
    const r = validar(v)
    return typeof r === 'string' ? { success: false, error: { message: r } } : { success: true, data: r.data }
  }
  return {
    safeParse,
    parse: (v) => {
      const r = safeParse(v)
      if (!r.success) throw new Error(r.error.message)
      return r.data
    },
  }
}

/** `every` que não pula buracos de array esparso (`[ , 1]`): cada índice conta. */
const todos = (a: readonly unknown[], f: (x: unknown) => boolean) => Array.from(a).every(f)
/** Texto de uma linha só: quebras e espaços repetidos viram um espaço; bordas aparadas. */
const limpo = (s: string) => s.replace(/\s+/g, ' ').trim()
const ehObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const rel = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1
const ehTipo = (t: unknown): t is TipoCamada => typeof t === 'string' && Object.prototype.hasOwnProperty.call(TIPOS, t)
const ponto = (p: unknown): p is Ponto => Array.isArray(p) && p.length === 2 && rel(p[0]) && rel(p[1])

/** Mantém `oculta` na saída (só booleano; qualquer outra coisa é recusada em `validarCamada`). */
const com = <C extends Camada>(c: C, v: Record<string, unknown>): C => (v.oculta === undefined ? c : { ...c, oculta: v.oculta as boolean })

function validarCamada(v: unknown): string | Camada {
  if (!ehObj(v)) return 'camada inválida'
  if (v.oculta !== undefined && typeof v.oculta !== 'boolean') return 'oculta deve ser verdadeiro ou falso'
  if (typeof v.id !== 'string' || v.id.length < 1 || v.id.length > 40) return 'id da camada inválido'
  if (!ehTipo(v.t)) return 'tipo de camada desconhecido'
  const grupo = TIPOS[v.t].grupo
  if (grupo === 'zona') {
    const r = v.r
    if (!Array.isArray(r) || r.length !== 4 || !todos(r, rel)) return 'zona precisa de r=[x,y,w,h] entre 0 e 1'
    const [x, y, w, h] = r as number[]
    if (!(w > 0) || !(h > 0) || x + w > 1 + EPS || y + h > 1 + EPS) return 'zona com largura/altura > 0 e dentro da planta (x+w ≤ 1, y+h ≤ 1)'
    const rot = typeof v.rot === 'string' ? limpo(v.rot) : v.rot
    if (rot != null && (typeof rot !== 'string' || rot.length > MAX_ROTULO)) return `rótulo da zona inválido (até ${MAX_ROTULO} caracteres)`
    if ('p' in v || 'at' in v) return 'zona só aceita r'
    const base: CamadaZona = { id: v.id, t: v.t as CamadaZona['t'], r: r as CamadaZona['r'] }
    return com(rot ? { ...base, rot } : base, v)
  }
  if (grupo === 'linha' || grupo === 'fluxo') {
    const p = v.p
    if (!Array.isArray(p) || p.length < 2 || p.length > MAX_PONTOS || !todos(p, ponto)) return 'linha precisa de 2 a 50 pontos entre 0 e 1'
    if ('r' in v || 'at' in v) return 'linha só aceita p'
    return com({ id: v.id, t: v.t as CamadaLinha['t'], p: p as Ponto[] }, v)
  }
  if (!ponto(v.at)) return 'ponto precisa de at=[x,y] entre 0 e 1'
  if ('r' in v || 'p' in v) return 'ponto só aceita at'
  return com({ id: v.id, t: v.t as CamadaPonto['t'], at: v.at }, v)
}

export const camadasSchema: Schema<Camada[]> = criarSchema((v) => {
  if (!Array.isArray(v)) return 'camadas deve ser uma lista'
  if (v.length > MAX_CAMADAS) return `no máximo ${MAX_CAMADAS} camadas`
  const ids = new Set<string>()
  const out: Camada[] = []
  for (const item of v) {
    const c = validarCamada(item)
    if (typeof c === 'string') return c
    if (ids.has(c.id)) return 'ids de camada repetidos'
    ids.add(c.id)
    out.push(c)
  }
  return { data: out }
})

export const regrasSchema: Schema<string[]> = criarSchema((v) => {
  if (!Array.isArray(v)) return 'regras deve ser uma lista'
  if (v.length > MAX_REGRAS) return `no máximo ${MAX_REGRAS} regras`
  const out: string[] = []
  for (let i = 0; i < v.length; i++) {
    const r: unknown = v[i]
    const t = typeof r === 'string' ? r.trim() : ''
    if (t.length < 1 || t.length > MAX_TEXTO_REGRA) return `cada regra tem de 1 a ${MAX_TEXTO_REGRA} caracteres`
    out.push(t)
  }
  return { data: out }
})

export type Carimbo = { titulo: string; cliente: string; desenho: string; base: string; rt: string }
const CAMPOS_CARIMBO = ['titulo', 'cliente', 'desenho', 'base', 'rt'] as const

export const carimboSchema: Schema<Carimbo> = criarSchema((v) => {
  if (!ehObj(v)) return 'carimbo inválido'
  const out = {} as Carimbo
  for (const k of CAMPOS_CARIMBO) {
    const s = v[k]
    const t = typeof s === 'string' ? limpo(s) : null
    if (t === null || t.length > MAX_TEXTO_CARIMBO) return `carimbo.${k} deve ser texto de até ${MAX_TEXTO_CARIMBO} caracteres`
    out[k] = t
  }
  return { data: out }
})

/** Tipos usados em `camadas`, na ordem fixa de `TIPOS`, com o nome legível. */
export function legendaDe<C extends { t: TipoCamada; oculta?: boolean }>(camadas: readonly C[]): { t: TipoCamada; nome: string }[] {
  const usados = new Set(camadas.filter((c) => !c.oculta).map((c) => c.t))
  return (Object.keys(TIPOS) as TipoCamada[]).filter((t) => usados.has(t)).map((t) => ({ t, nome: TIPOS[t].nome }))
}

// ---- Semente: Fase 1 do mockup aprovado (viewBox 1000x700 -> relativo) ----
const X = (v: number) => Math.round((v / 1000) * 10000) / 10000
const Y = (v: number) => Math.round((v / 700) * 10000) / 10000
const R = (x: number, y: number, w: number, h: number): [number, number, number, number] => [X(x), Y(y), X(w), Y(h)]
const P = (...pts: [number, number][]): Ponto[] => pts.map(([x, y]) => [X(x), Y(y)])

export const CAMADAS_EXEMPLO_FASE1: Camada[] = [
  { id: 'c1', t: 'zona_obra', r: R(20, 20, 360, 660), rot: 'ZONA DE OBRA · FASE 1' },
  { id: 'c2', t: 'zona_obra', r: R(380, 480, 600, 200) },
  { id: 'c3', t: 'zona_salao', r: R(380, 140, 600, 260), rot: 'SALÃO EM OPERAÇÃO' },
  { id: 'c4', t: 'zona_uso', r: R(380, 20, 140, 120), rot: 'COPA 9,97 m² · EM USO' },
  { id: 'c5', t: 'zona_atend', r: R(380, 400, 600, 80), rot: 'FAIXA DE ATENDIMENTO' },
  { id: 'c6', t: 'restrita', r: R(40, 40, 200, 170), rot: 'MEZANINO · RESTRITO' },
  { id: 'c7', t: 'drywall', p: P([380, 20], [380, 480], [980, 480]) },
  { id: 'c8', t: 'balcao', p: P([380, 400], [980, 400]) },
  { id: 'c9', t: 'porta_obra', at: [X(980), Y(600)] },
  { id: 'c10', t: 'porta_exist', at: [X(980), Y(240)] },
  { id: 'c11', t: 'fluxo_cli', p: P([975, 240], [820, 240], [700, 300]) },
  { id: 'c12', t: 'fluxo_obra', p: P([975, 600], [700, 600], [300, 600], [200, 420]) },
  { id: 'c13', t: 'extintor', at: [X(930), Y(540)] },
  { id: 'c14', t: 'emerg', at: [X(300), Y(500)] },
]
