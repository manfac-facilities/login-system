/**
 * Fotos extras e avarias do checklist — funções PURAS (spec 2026-11-03 §2.7/§2.8).
 * O teto de 30 fotos é do app (tela + action), não do banco.
 */

export const TETO_FOTOS = 30

export const PECAS_AVARIA = [
  'Para-choque dianteiro',
  'Para-choque traseiro',
  'Porta esquerda',
  'Porta direita',
  'Retrovisor',
  'Farol / lanterna',
  'Pneu / roda',
  'Para-brisa',
  'Outra peça',
] as const

export type TamanhoAvaria = 'pequena' | 'media' | 'grande'
export type AcaoAvaria = 'reparo' | 'troca'
export type TipoFoto = 'obrigatoria' | 'interna' | 'extra' | 'avaria_peca' | 'avaria_dano'

export const TAMANHOS_AVARIA: readonly { valor: TamanhoAvaria; rotulo: string }[] = [
  { valor: 'pequena', rotulo: 'Pequena (até 5 cm)' },
  { valor: 'media', rotulo: 'Média (5 a 20 cm)' },
  { valor: 'grande', rotulo: 'Grande (acima de 20 cm)' },
]

export function rotuloTamanho(t: string | null | undefined): string {
  return TAMANHOS_AVARIA.find((x) => x.valor === t)?.rotulo ?? 'tamanho não informado'
}

export function ehPecaValida(p: unknown): boolean {
  return typeof p === 'string' && (PECAS_AVARIA as readonly string[]).includes(p)
}

export function ehTamanhoValido(t: unknown): t is TamanhoAvaria {
  return t === 'pequena' || t === 'media' || t === 'grande'
}

/** Foto ainda não salva (rascunho do formulário). */
export interface FotoRascunho {
  id: string
  blob: Blob
  url: string
  lat: number | null
  lng: number | null
}

export interface AvariaRascunho {
  id: string
  peca: string
  tamanho: TamanhoAvaria | ''
  acao: AcaoAvaria | ''
  descricao: string
  fotosPeca: FotoRascunho[]
  fotosDano: FotoRascunho[]
}

/** Total de fotos do checklist: obrigatórias + interna + extras + fotos de avaria. */
export function contarFotos(p: {
  obrigatorias: number
  interna: number
  extras: number
  avarias: readonly { fotosPeca: number | readonly unknown[]; fotosDano: number | readonly unknown[] }[]
}): number {
  const n = (v: number | readonly unknown[]) => (typeof v === 'number' ? v : v.length)
  return p.obrigatorias + p.interna + p.extras + p.avarias.reduce((s, a) => s + n(a.fotosPeca) + n(a.fotosDano), 0)
}

export function cabeMaisFoto(total: number): boolean {
  return total < TETO_FOTOS
}

/** null = pode adicionar; senão "Falta: peça, tamanho, foto da peça, foto da avaria". */
export function validarAvariaRascunho(a: {
  peca: string
  tamanho: string
  fotosPeca: number | readonly unknown[]
  fotosDano: number | readonly unknown[]
}): string | null {
  const n = (v: number | readonly unknown[]) => (typeof v === 'number' ? v : v.length)
  const falta: string[] = []
  if (!a.peca?.trim()) falta.push('peça')
  if (!ehTamanhoValido(a.tamanho)) falta.push('tamanho')
  if (n(a.fotosPeca) < 1) falta.push('foto da peça')
  if (n(a.fotosDano) < 1) falta.push('foto da avaria')
  return falta.length ? `Falta: ${falta.join(', ')}` : null
}

export function posicaoExtra(n: number): string {
  return `Extra ${n}`
}

/** Posição gravada das fotos de avaria: "Avaria 1 peça 1", "Avaria 1 dano 2"… */
export function posicaoAvaria(indiceAvaria: number, tipo: 'peca' | 'dano', n: number): string {
  return `Avaria ${indiceAvaria} ${tipo === 'peca' ? 'peça' : 'dano'} ${n}`
}

/** true se o rascunho de avaria tem qualquer dado (e portanto se perderia ao enviar sem adicionar). */
export function avariaRascunhoTemDados(a: {
  peca: string
  tamanho: string
  acao: string
  descricao: string
  fotosPeca: readonly unknown[]
  fotosDano: readonly unknown[]
}): boolean {
  return !!(a.peca || a.tamanho || a.acao || a.descricao?.trim() || a.fotosPeca.length || a.fotosDano.length)
}
