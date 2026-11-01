/**
 * Regras puras do mapa de obra (Leva 6): avanço por ambiente, faixa de cor,
 * ronda do dia, fotos do ponto e comparação antes × depois. Sem banco.
 * Percentuais seguem o motor do cronograma: fração 0-1.
 */
import type { AtividadeCalculada } from './cronograma'

export type VinculoAmbienteAtividade = { ambienteId: string; atividadeNumero: number }

export type PontoMapa = {
  id: string
  numero: number
  nome: string
  ambienteId: string
  x: number | null
  y: number | null
  ativo: boolean
}

/** Foto do diário com os vínculos do mapa. `data` = data do RDO; `estado` = estado do RDO. */
export type FotoMapa = {
  id: string
  rdoId: string
  path: string
  legenda: string | null
  ordem: number
  data: string
  estado: string
  ambienteId: string | null
  pontoId: string | null
  atividadeNumero: number | null
}

const num = (n: number) => (Number.isFinite(n) ? n : 0)

/**
 * Avanço do ambiente (fração 0-1) = média das atividades ligadas que existem no
 * cálculo da versão vigente, ponderada por `peso` (o peso normalizado do motor,
 * que já aplica o critério valor/duração da obra - Leva 2). Se as atividades
 * ligadas somam peso 0, pondera pela duração (mín. 1), como `resumirEtapas`.
 * Sem ligação, ou ligação só a atividades fora da versão -> null ("-"), nunca NaN.
 */
export function avancoDoAmbiente(
  ambienteId: string,
  vinculos: VinculoAmbienteAtividade[],
  atividadesCalc: AtividadeCalculada[],
): number | null {
  const numeros = new Set(vinculos.filter((x) => x.ambienteId === ambienteId).map((x) => x.atividadeNumero))
  if (!numeros.size) return null
  const ligadas = atividadesCalc.filter((a) => numeros.has(a.numero))
  if (!ligadas.length) return null
  const somaPeso = ligadas.reduce((s, a) => s + num(a.peso), 0)
  const pesoDe = (a: AtividadeCalculada) => (somaPeso > 0 ? num(a.peso) : Math.max(num(a.duracao), 1))
  const total = ligadas.reduce((s, a) => s + pesoDe(a), 0)
  if (!(total > 0)) return null
  const pct = ligadas.reduce((s, a) => s + pesoDe(a) * num(a.percentual), 0) / total
  return Number.isFinite(pct) ? pct : null
}

/** 0 = parado (exatamente 0%), 1 = >0-25%, 2 = 26-50%, 3 = 51-75%, 4 = 76-100%; null = sem avanço ("-"). Fração 0-1. */
export function faixaDeCor(pct: number | null): 0 | 1 | 2 | 3 | 4 | null {
  if (pct === null || !Number.isFinite(pct)) return null
  if (pct <= 0) return 0
  // Qualquer avanço > 0 já é faixa 1 (0,4% não pode aparecer como "parado").
  const p = Math.max(1, Math.round(Math.min(pct, 1) * 100))
  if (p <= 25) return 1
  if (p <= 50) return 2
  if (p <= 75) return 3
  return 4
}

/** Ronda do dia: pontos ativos com ao menos uma foto do dia; `faltando` em ordem de número. */
export function rondaDoDia(
  pontosAtivos: PontoMapa[],
  fotosDoDia: Pick<FotoMapa, 'pontoId'>[],
): { feitos: number; total: number; faltando: PontoMapa[] } {
  const ativos = pontosAtivos.filter((x) => x.ativo)
  const comFoto = new Set(fotosDoDia.map((x) => x.pontoId).filter((x): x is string => !!x))
  const faltando = ativos.filter((x) => !comFoto.has(x.id)).sort((a, b) => a.numero - b.numero)
  return { feitos: ativos.length - faltando.length, total: ativos.length, faltando }
}

const porDataOrdem = (a: FotoMapa, b: FotoMapa) =>
  a.data === b.data ? a.ordem - b.ordem : a.data < b.data ? -1 : 1

/** Fotos de um ponto, da mais antiga para a mais nova (data do RDO, depois `ordem`). */
export function fotosDoPonto(pontoId: string, fotos: FotoMapa[]): FotoMapa[] {
  return fotos.filter((x) => x.pontoId === pontoId).sort(porDataOrdem)
}

/**
 * Par padrão do antes x depois (recebe as fotos do ponto, em qualquer ordem).
 * 'inicio': primeira x última. 'ontem': última foto de `hoje` x última anterior a `hoje`.
 * Sem par possível -> null.
 */
export function comparacaoPadrao(
  fotos: FotoMapa[],
  modo: 'inicio' | 'ontem',
  hoje: string,
): { antes: FotoMapa; depois: FotoMapa } | null {
  const ord = [...fotos].sort(porDataOrdem)
  if (modo === 'inicio') return ord.length >= 2 ? { antes: ord[0], depois: ord[ord.length - 1] } : null
  const rev = [...ord].reverse()
  const depois = rev.find((x) => x.data === hoje)
  const antes = rev.find((x) => x.data < hoje)
  return depois && antes ? { antes, depois } : null
}
