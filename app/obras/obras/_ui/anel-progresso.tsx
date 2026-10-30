import { TEMA_OBRA as T } from './tema'

/**
 * Anel de % (estilo Builderpad). `valor` é fração 0–1 (limitada). A partir de
 * 36px o % aparece no centro; menor que isso, o rótulo acessível basta e quem
 * usa costuma pôr o número ao lado. 100% fica verde; o resto, laranja.
 */
export default function AnelProgresso({
  valor,
  tamanho = 28,
  espessura,
}: {
  valor: number
  tamanho?: number
  espessura?: number
}) {
  const v = Math.min(1, Math.max(0, Number.isFinite(valor) ? valor : 0))
  const pct = Math.round(v * 100)
  const e = espessura ?? Math.max(3, Math.round(tamanho / 9))
  const r = (tamanho - e) / 2
  const c = 2 * Math.PI * r
  const comCentro = tamanho >= 36
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${tamanho} ${tamanho}`}
      role="img"
      aria-label={`${pct}% concluído`}
      className="shrink-0"
    >
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={T.trilho} strokeWidth={e} />
      {pct > 0 ? (
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          fill="none"
          stroke={pct === 100 ? T.verde : T.orange}
          strokeWidth={e}
          strokeLinecap={pct === 100 ? 'butt' : 'round'}
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
        />
      ) : null}
      {comCentro ? (
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="obra-num"
          fontSize={Math.round(tamanho * 0.26)}
          fill={T.ink}
        >
          {pct}%
        </text>
      ) : null}
    </svg>
  )
}
