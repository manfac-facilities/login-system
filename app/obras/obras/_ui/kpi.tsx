import type { ReactNode } from 'react'
import { COR_TOM, type TomObra } from './tema'

/** Unidade do numeral ("p.p.", "dias") em corpo menor, para o número caber no cartão. */
export function Unidade({ children }: { children: ReactNode }) {
  return <span className="text-[0.55em] tracking-normal">{children}</span>
}

/**
 * Cartão de KPI (estilo ConstructOS): rótulo pequeno, numeral grande e fino em
 * IBM Plex Mono, linha de apoio. O `tom` pinta o numeral com a variante de
 * texto acessível e um traço de 3px no topo — o rótulo/sub carregam o sentido.
 */
export default function Kpi({
  rotulo,
  valor,
  sub,
  tom = 'neutro',
  icone,
}: {
  rotulo: string
  valor: ReactNode
  sub?: ReactNode
  tom?: TomObra
  icone?: ReactNode
}) {
  const cor = COR_TOM[tom]
  return (
    <div className="relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border border-(--obra-border) bg-(--obra-card) px-4 pt-4 pb-3.5">
      {tom !== 'neutro' ? (
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: cor.cheio }} />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[12px] leading-4 font-medium uppercase tracking-[0.06em] text-(--obra-muted-texto)">
          {rotulo}
        </span>
        {icone ? <span className="shrink-0 text-(--obra-muted)">{icone}</span> : null}
      </div>
      <div className="obra-num truncate text-[26px] leading-none font-normal sm:text-[30px] 2xl:text-[34px]" style={{ color: cor.texto }}>
        {valor}
      </div>
      {sub ? <div className="min-h-4 text-[12px] leading-4 text-(--obra-muted-texto)">{sub}</div> : null}
    </div>
  )
}
