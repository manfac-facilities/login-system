import { TEMA_OBRA as T } from './tema'

export type PontoPpcSemana = { semana: string; ppc: number; avaliados: number }

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const pct = (v: number) => `${Math.round(v * 100)}%`

/** Barras do PPC das últimas semanas avaliadas (SVG simples + tabela para leitor de tela). */
export default function PpcSemanas({ pontos }: { pontos: PontoPpcSemana[] }) {
  if (pontos.length === 0) {
    return (
      <p className="text-[14px] text-(--obra-muted-texto)">
        <span className="obra-num text-[22px] font-semibold text-(--obra-ink)">—</span> Nenhuma semana avaliada ainda.
      </p>
    )
  }
  const H = 140
  const W = 320
  const topo = 16
  const base = H - 22
  const g = W / pontos.length
  const bw = Math.min(28, g - 10)
  const resumo = pontos.map((p) => `semana de ${dm(p.semana)}: ${pct(p.ppc)}`).join('; ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`PPC por semana. ${resumo}`} className="h-auto w-full max-w-lg">
        <line x1={0} x2={W} y1={base} y2={base} stroke={T.border} />
        <line x1={0} x2={W} y1={topo} y2={topo} stroke={T.border} strokeDasharray="3 3" />
        {pontos.map((p, i) => {
          const h = Math.max(1, p.ppc * (base - topo))
          const x = i * g + (g - bw) / 2
          return (
            <g key={p.semana}>
              <rect x={x} y={base - h} width={bw} height={h} rx={3} fill={p.ppc >= 0.8 ? T.verde : p.ppc >= 0.6 ? T.yellow : T.vermelho} />
              <text x={x + bw / 2} y={base - h - 4} textAnchor="middle" fontSize={10} fill={T.text}>
                {pct(p.ppc)}
              </text>
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={T.mutedTexto}>
                {dm(p.semana)}
              </text>
            </g>
          )
        })}
      </svg>
      <table className="sr-only">
        <caption>PPC por semana</caption>
        <thead>
          <tr>
            <th>Semana</th>
            <th>PPC</th>
            <th>Itens avaliados</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((p) => (
            <tr key={p.semana}>
              <td>{dm(p.semana)}</td>
              <td>{pct(p.ppc)}</td>
              <td>{p.avaliados}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
