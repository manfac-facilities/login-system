import { pct } from './cartao-painel'

/**
 * Avanço físico (spec Leva 1 §6.2): três barras Base · Previsto · Realizado com o
 * % de cada na data de hoje. Base = contorno tracejado (a "foto" da v1); cada
 * barra tem o nome e o número ao lado — a cor só reforça.
 */
export default function AvancoFisico({
  base,
  previsto,
  realizado,
}: {
  base: number | null
  previsto: number
  realizado: number
}) {
  const linhas = [
    { nome: 'Base', valor: base, cls: 'border-[1.5px] border-dashed border-(--obra-base) bg-white', nota: base === null ? 'ainda não salva' : 'v1' },
    { nome: 'Previsto', valor: previsto, cls: 'bg-(--obra-ink)', nota: 'vigente' },
    { nome: 'Realizado', valor: realizado, cls: 'bg-(--obra-orange)', nota: null },
  ]
  return (
    <ul className="flex flex-col gap-4">
      {linhas.map((l) => {
        const w = l.valor === null ? 0 : Math.min(100, Math.max(0, l.valor * 100))
        return (
          <li key={l.nome} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-(--obra-text)">
                {l.nome}
                {l.nota ? <span className="ml-1.5 text-[12px] font-normal text-(--obra-muted-texto)">{l.nota}</span> : null}
              </span>
              <span className="obra-num text-[22px] leading-none font-normal text-(--obra-ink)">
                {l.valor === null ? '—' : pct(l.valor)}
              </span>
            </div>
            <div
              role="meter"
              aria-label={l.nome}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={l.valor === null ? undefined : Math.round(w)}
              aria-valuetext={l.valor === null ? 'sem base' : pct(l.valor)}
              className="relative h-3 overflow-hidden rounded-full bg-(--obra-trilho)"
            >
              {w > 0 ? <span className={`absolute inset-y-0 left-0 rounded-full ${l.cls}`} style={{ width: `${w}%` }} /> : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
