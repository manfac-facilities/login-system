/**
 * Histórico e comparação de checklists do mesmo veículo — funções PURAS
 * (spec 2026-11-03 §2.9). Compara só DADOS (itens e avarias), nunca imagem.
 * Sem KM: a tabela checklist não tem coluna de KM.
 */

export const ITENS_CHECKLIST_HIST = [
  ['lataria_ok', 'Lataria'],
  ['vidros_ok', 'Vidros'],
  ['pneus_ok', 'Pneus'],
  ['combustivel_ok', 'Combustível'],
  ['itens_internos_ok', 'Itens internos'],
  ['estepe_ok', 'Estepe'],
  ['macaco_ok', 'Macaco'],
  ['triangulo_ok', 'Triângulo'],
] as const

export type ItemChecklist = (typeof ITENS_CHECKLIST_HIST)[number][0]

export type ChecklistHist = {
  id: string
  data: string
} & Partial<Record<ItemChecklist, boolean | null>>

export interface AvariaHist {
  id: string
  peca: string
  descricao: string | null
  /** data do checklist em que a avaria foi registrada */
  registrada_em: string
  reparada_em: string | null
}

export type TipoDiff = 'item_piorou' | 'item_melhorou' | 'avaria_nova' | 'avaria_resolvida' | 'avaria_continua'

export interface ItemDiff {
  tipo: TipoDiff
  texto: string
}

const t = (iso: string) => new Date(iso).getTime()

/** "Antes" é sempre o mais antigo; `reordenado` avisa a tela que trocou. */
export function ordenarAntesDepois<T extends { data: string }>(
  a: T,
  b: T
): { antes: T; depois: T; reordenado: boolean } {
  return t(a.data) <= t(b.data) ? { antes: a, depois: b, reordenado: false } : { antes: b, depois: a, reordenado: true }
}

function porDataDesc<T extends { data: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((x, y) => t(y.data) - t(x.data))
}

/** Padrão (decisão 1): depois = o mais recente, antes = o anterior. Menos de 2 → null. */
export function escolhaPadrao<T extends { id: string; data: string }>(lista: readonly T[]): { a: T; b: T } | null {
  if (lista.length < 2) return null
  const [b, a] = porDataDesc(lista)
  return { a, b }
}

/** O primeiro checklist do veículo é a base (entrada). */
export function baseDoVeiculo<T extends { data: string }>(lista: readonly T[]): T | null {
  if (lista.length === 0) return null
  return porDataDesc(lista)[lista.length - 1]
}

/** Aberta no momento `dataISO`: registrada até essa data e não reparada até ela. */
export function avariasAbertasEm<T extends AvariaHist>(avarias: readonly T[], dataISO: string): T[] {
  const d = t(dataISO)
  return avarias.filter((a) => t(a.registrada_em) <= d && (a.reparada_em === null || t(a.reparada_em) > d))
}

export function diffChecklists(antes: ChecklistHist, depois: ChecklistHist, avarias: readonly AvariaHist[]): ItemDiff[] {
  const out: ItemDiff[] = []
  for (const [k, rotulo] of ITENS_CHECKLIST_HIST) {
    const x = antes[k]
    const y = depois[k]
    if (x === true && y === false) out.push({ tipo: 'item_piorou', texto: `${rotulo}: OK passou para problema` })
    if (x === false && y === true) out.push({ tipo: 'item_melhorou', texto: `${rotulo}: problema passou para OK` })
  }
  const emA = new Set(avariasAbertasEm(avarias, antes.data).map((a) => a.id))
  const emB = avariasAbertasEm(avarias, depois.data)
  const idsB = new Set(emB.map((a) => a.id))
  for (const a of emB)
    if (!emA.has(a.id))
      out.push({
        tipo: 'avaria_nova',
        texto: `Avaria nova: ${a.peca}${a.descricao ? `, ${a.descricao.toLowerCase()}` : ''}`,
      })
  for (const a of avarias)
    if (emA.has(a.id) && !idsB.has(a.id)) out.push({ tipo: 'avaria_resolvida', texto: `Avaria resolvida: ${a.peca}` })
  for (const a of emB) if (emA.has(a.id)) out.push({ tipo: 'avaria_continua', texto: `Avaria continua: ${a.peca}` })
  return out
}
