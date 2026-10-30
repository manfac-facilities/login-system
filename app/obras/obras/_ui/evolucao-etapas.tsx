import { deltaDiasUteis, type AtividadeCalculada, type ResumoEtapa } from '../_lib/cronograma'
import { ddmm, pct } from './cartao-painel'
import { CORES_ETAPA } from './tema'

/**
 * Evolução por etapa (spec Leva 1 §6.5): uma linha por etapa com bullet bar —
 * Base em contorno tracejado, Realizado em laranja, Previsto como marcador azul —
 * e o Δ de dias úteis do fim da etapa (projetado vigente × previsto na base).
 */
export type LinhaEtapa = {
  etapa: string
  cor: string
  base: number | null
  previsto: number
  realizado: number
  fimProjetado: string
  deltaDias: number | null
}

/** % previsto hoje da etapa, ponderado como `resumirEtapas` (peso; duração se a etapa soma peso 0). */
function previstoDaEtapa(as: AtividadeCalculada[]): number {
  const soma = as.reduce((s, a) => s + a.peso, 0)
  const peso = (a: AtividadeCalculada) => (soma > 0 ? a.peso : Math.max(a.duracao, 1))
  const total = as.reduce((s, a) => s + peso(a), 0)
  return total > 0 ? as.reduce((s, a) => s + peso(a) * a.percentualPrevisto, 0) / total : 0
}

export function linhasDeEtapa(
  etapas: ResumoEtapa[],
  vigente: AtividadeCalculada[],
  base: AtividadeCalculada[] | null,
  feriados: ReadonlySet<string>,
): LinhaEtapa[] {
  return etapas.map((e, i) => {
    const nums = new Set(e.numeros)
    const daBase = base?.filter((a) => nums.has(a.numero)) ?? []
    const fimBase = daBase.length ? daBase.reduce((m, a) => (a.fimPrevisto > m ? a.fimPrevisto : m), '') : null
    return {
      etapa: e.etapa,
      cor: CORES_ETAPA[i % CORES_ETAPA.length],
      base: daBase.length ? previstoDaEtapa(daBase) : null,
      previsto: previstoDaEtapa(vigente.filter((a) => nums.has(a.numero))),
      realizado: e.percentual,
      fimProjetado: e.fimProjetado,
      deltaDias: fimBase ? deltaDiasUteis(fimBase, e.fimProjetado, feriados) : null,
    }
  })
}

function Delta({ d }: { d: number | null }) {
  if (d === null) return <span className="text-(--obra-muted-texto)">sem base</span>
  if (d === 0) return <span className="text-(--obra-verde-texto)">no prazo</span>
  const txt = `${d > 0 ? '+' : '−'}${Math.abs(d)} ${Math.abs(d) === 1 ? 'dia' : 'dias'}`
  return <span className={d > 0 ? 'font-semibold text-(--obra-vermelho-texto)' : 'text-(--obra-verde-texto)'}>{txt}</span>
}

const largura = (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`

export default function EvolucaoEtapas({ linhas }: { linhas: LinhaEtapa[] }) {
  return (
    <ul className="flex flex-col divide-y divide-(--obra-border)">
      {linhas.map((l) => (
        <li key={l.etapa} className="grid grid-cols-1 gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,14rem)_1fr_7.5rem] sm:items-center sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.cor }} />
            <span className="truncate text-[13px] font-medium text-(--obra-text)" title={l.etapa}>
              {l.etapa}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="relative h-4" aria-hidden>
              <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-(--obra-trilho)" />
              {l.base !== null && l.base > 0 ? (
                <span
                  className="absolute top-0 left-0 h-4 rounded-[4px] border-[1.5px] border-dashed border-(--obra-base)"
                  style={{ width: largura(l.base) }}
                />
              ) : null}
              {l.realizado > 0 ? (
                <span className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full bg-(--obra-orange)" style={{ width: largura(l.realizado) }} />
              ) : null}
              <span
                className="absolute top-0 h-4 w-[3px] -translate-x-1/2 rounded-full bg-(--obra-ink)"
                style={{ left: largura(l.previsto) }}
              />
            </div>
            <p className="obra-num text-[12px] text-(--obra-muted-texto)">
              Real <span className="text-(--obra-text)">{pct(l.realizado)}</span> · Prev{' '}
              <span className="text-(--obra-text)">{pct(l.previsto)}</span>
              {l.base !== null ? (
                <>
                  {' '}· Base <span className="text-(--obra-text)">{pct(l.base)}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-[13px] sm:flex-col sm:items-end sm:gap-0">
            <Delta d={l.deltaDias} />
            <span className="obra-num text-[12px] text-(--obra-muted-texto)">fim {ddmm(l.fimProjetado)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
