import type { LinhaGantt } from '../../../obras/painel/_calculos'

/** Prioridade da linha no recorte: 1 atrasada, 2 parada, 3 a iniciar, 4 em campo no prazo, 5 terminou. */
function prioridade(l: LinhaGantt): 1 | 2 | 3 | 4 | 5 {
  if (l.atrasada) return 1
  if (l.parada) return 2
  if (l.grupo === 'iniciar') return 3
  if (l.grupo === 'campo') return 4
  return 5
}

const inicio = (l: LinhaGantt) => l.planIni ?? l.realIni ?? ''
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Ordem dentro da prioridade; negativo = `a` antes de `b`. */
function ordemInterna(p: number, a: LinhaGantt, b: LinhaGantt): number {
  if (p === 1) return b.diasAtraso - a.diasAtraso
  if (p === 5) return cmp(b.realFim ?? '', a.realFim ?? '')
  return cmp(inicio(a), inicio(b))
}

/**
 * As obras mais críticas do cronograma, na ordem em que a imagem as desenha.
 * Não altera a lista recebida.
 */
export function recorteDoCronograma(linhas: LinhaGantt[], limite = 7): LinhaGantt[] {
  return linhas
    .map((l) => ({ l, p: prioridade(l) }))
    .sort((x, y) => x.p - y.p || ordemInterna(x.p, x.l, y.l) || cmp(x.l.obra.os ?? '', y.l.obra.os ?? ''))
    .slice(0, limite)
    .map((x) => x.l)
}
