import type { ReactNode } from 'react'
import { TEMA_OBRA as T } from './tema'

/**
 * Peças comuns dos blocos do painel (spec Leva 1 §6): o cartão claro (borda 1px,
 * raio 12px, sem sombra) e a legenda das três séries — sempre em texto, com a
 * amostra do traço ao lado (a Base é tracejada; cor nunca é o único sinal).
 */
export function Cartao({
  titulo,
  sub,
  acao,
  rotulado = 'section',
  id,
  className = '',
  children,
}: {
  titulo: string
  sub?: ReactNode
  acao?: ReactNode
  /** `figure` para gráficos (o título vira o nome acessível). */
  rotulado?: 'section' | 'figure'
  id: string
  className?: string
  children: ReactNode
}) {
  const Tag = rotulado
  return (
    <Tag
      aria-labelledby={id}
      className={`flex min-w-0 flex-col gap-4 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className="text-[15px] leading-6 font-semibold text-(--obra-ink)">
            {titulo}
          </h2>
          {sub ? <p className="text-[12px] leading-4 text-(--obra-muted-texto)">{sub}</p> : null}
        </div>
        {acao}
      </div>
      {children}
    </Tag>
  )
}

export type SerieId = 'base' | 'previsto' | 'realizado'

export const ROTULO_SERIE: Record<SerieId, string> = { base: 'Base', previsto: 'Previsto', realizado: 'Realizado' }

/** Amostra do traço de cada série (16×10). */
export function AmostraSerie({ serie, forma = 'linha' }: { serie: SerieId; forma?: 'linha' | 'barra' }) {
  if (forma === 'barra') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="shrink-0">
        {serie === 'base' ? (
          <rect x="1" y="1" width="10" height="10" rx="2" fill="#fff" stroke={T.base} strokeWidth="1.5" strokeDasharray="3 2" />
        ) : (
          <rect x="0" y="0" width="12" height="12" rx="2.5" fill={serie === 'previsto' ? T.ink : T.orange} />
        )}
      </svg>
    )
  }
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true" focusable="false" className="shrink-0">
      <line
        x1="1" y1="5" x2="17" y2="5" strokeLinecap="round"
        stroke={serie === 'base' ? T.base : serie === 'previsto' ? T.ink : T.orange}
        strokeWidth={serie === 'base' ? 2 : 2.5}
        strokeDasharray={serie === 'base' ? '4 3' : undefined}
      />
      {serie === 'realizado' ? <circle cx="9" cy="5" r="3" fill={T.orange} stroke="#fff" strokeWidth="1.5" /> : null}
    </svg>
  )
}

/** Legenda em texto: nome da série + detalhe ("v1", "até 23/10"…). */
export function LegendaSeries({
  itens,
  forma = 'linha',
}: {
  itens: { serie: SerieId; detalhe?: string }[]
  forma?: 'linha' | 'barra'
}) {
  return (
    <ul aria-label="Legenda" className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {itens.map((i) => (
        <li key={i.serie} className="flex items-center gap-1.5 text-[12px] leading-4">
          <AmostraSerie serie={i.serie} forma={forma} />
          <span className="font-medium text-(--obra-text)">{ROTULO_SERIE[i.serie]}</span>
          {i.detalhe ? <span className="text-(--obra-muted-texto)">{i.detalhe}</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** "dd/mm" de `YYYY-MM-DD`. */
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
/** "dd/mm/aaaa" de `YYYY-MM-DD`. */
export const dataBR = (iso: string) => iso.split('-').reverse().join('/')
/** "out/26" de `YYYY-MM-DD`. */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`
/** Fração 0–1 → "37%". */
export const pct = (f: number) => `${Math.round(f * 100)}%`
/** Número com 1 casa no padrão brasileiro ("3,5"). */
export const num1 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })
