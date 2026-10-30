'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { ddmm, LegendaSeries, mesAno, num1 } from './cartao-painel'
import { useLargura } from './curva-s'
import { TEMA_OBRA as T } from './tema'

/**
 * Progresso por período (spec Leva 1 §6.4): barras agrupadas Base · Previsto ·
 * Realizado com os p.p. de avanço de cada semana (termina na sexta) ou mês,
 * alternável. Base é contorno tracejado (nunca cheia). Mouse/foco + setas
 * mostram os valores; a tabela escondida repete tudo para leitor de tela.
 */
export type Periodo = { periodo: string; base: number; previsto: number; realizado: number }

const ROTULO_PASSO = { semana: 'Semanal', mes: 'Mensal' } as const
type Passo = keyof typeof ROTULO_PASSO

const fmtPP = (v: number) => `${v > 0 ? '+' : ''}${num1(v)} p.p.`

export default function BarrasPeriodo({
  semanal,
  mensal,
  temBase,
}: {
  semanal: Periodo[]
  mensal: Periodo[]
  temBase: boolean
}) {
  const [passo, setPasso] = useState<Passo>('semana')
  const [ativo, setAtivo] = useState<number | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const largura = useLargura(caixa, 720)

  const dados = passo === 'semana' ? semanal : mensal
  const rotulo = (p: Periodo) => (passo === 'semana' ? ddmm(p.periodo) : mesAno(p.periodo))
  const series = (temBase ? ['base', 'previsto', 'realizado'] : ['previsto', 'realizado']) as ('base' | 'previsto' | 'realizado')[]

  const H = 220
  const M = { t: 24, r: 8, b: 28, l: 44 }
  const minGrupo = series.length * 12 + 16
  const W = Math.max(largura, M.l + M.r + dados.length * minGrupo)
  const iw = W - M.l - M.r
  const ih = H - M.t - M.b
  const grupo = iw / Math.max(1, dados.length)
  const bw = Math.min(14, (grupo - 12 - (series.length - 1) * 2) / series.length)
  const maximo = Math.max(5, ...dados.flatMap((d) => [d.base, d.previsto, d.realizado]))
  const topo = Math.ceil(maximo / 5) * 5
  const ticks = [0, topo / 2, topo]
  const y = (v: number) => M.t + (1 - Math.max(0, v) / topo) * ih
  const passoRotulo = Math.max(1, Math.ceil(40 / grupo))

  const cor = { base: T.base, previsto: T.ink, realizado: T.orange }

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const ult = dados.length - 1
    const prox =
      e.key === 'ArrowRight' ? Math.min(ult, (ativo ?? -1) + 1)
      : e.key === 'ArrowLeft' ? Math.max(0, (ativo ?? ult + 1) - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? ult
      : e.key === 'Escape' ? null
      : undefined
    if (prox === undefined) return
    e.preventDefault()
    setAtivo(prox)
  }
  const at = ativo === null ? null : dados[ativo]
  const xGrupo = (i: number) => M.l + i * grupo

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LegendaSeries
          forma="barra"
          itens={[
            ...(temBase ? [{ serie: 'base' as const, detalhe: 'v1' }] : []),
            { serie: 'previsto' as const },
            { serie: 'realizado' as const },
          ]}
        />
        <div role="group" aria-label="Período" className="inline-flex rounded-lg border border-(--obra-border) bg-(--obra-surface) p-0.5">
          {(Object.keys(ROTULO_PASSO) as Passo[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={passo === p}
              onClick={() => {
                setPasso(p)
                setAtivo(null)
              }}
              className={
                'min-h-11 rounded-md px-3 text-[13px] font-medium transition-colors duration-150 ' +
                (passo === p ? 'bg-white text-(--obra-ink) shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-(--obra-muted-texto) hover:text-(--obra-ink)')
              }
            >
              {ROTULO_PASSO[p]}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={caixa}
        tabIndex={0}
        role="group"
        aria-label={`Barras de progresso ${ROTULO_PASSO[passo].toLowerCase()}. Use as setas para percorrer os períodos.`}
        onKeyDown={teclas}
        onBlur={() => setAtivo(null)}
        className="relative w-full overflow-x-auto rounded-lg"
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" className="block" onPointerLeave={() => setAtivo(null)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={M.l + iw} y1={y(v)} y2={y(v)} stroke={v === 0 ? T.border : T.trilho} strokeWidth="1" />
              <text x={M.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill={T.mutedTexto} className="obra-num">
                {num1(v)}
              </text>
            </g>
          ))}
          {/* Unidade acima do eixo, alinhada aos números (antes encostava no "15": "p.p.15"). */}
          <text x={M.l - 8} y={M.t - 12} textAnchor="end" fontSize="10" fill={T.mutedTexto}>p.p.</text>
          {dados.map((d, i) => {
            const x0 = xGrupo(i) + (grupo - (series.length * bw + (series.length - 1) * 2)) / 2
            return (
              <g key={d.periodo} onPointerEnter={() => setAtivo(i)}>
                <rect x={xGrupo(i)} y={M.t} width={grupo} height={ih} fill={ativo === i ? T.ink : 'transparent'} fillOpacity={ativo === i ? 0.05 : 0} />
                {series.map((s, k) => {
                  const v = d[s]
                  const h = Math.max(0, y(0) - y(v))
                  const bx = x0 + k * (bw + 2)
                  if (h <= 0) return null
                  const r = Math.min(3, bw / 2, h)
                  // Ponta de dados arredondada, base reta.
                  const dPath = `M${bx},${y(0)}V${y(v) + r}Q${bx},${y(v)} ${bx + r},${y(v)}H${bx + bw - r}Q${bx + bw},${y(v)} ${bx + bw},${y(v) + r}V${y(0)}Z`
                  return s === 'base' ? (
                    <path key={s} d={dPath} fill="#fff" stroke={cor.base} strokeWidth="1.5" strokeDasharray="3 2" />
                  ) : (
                    <path key={s} d={dPath} fill={cor[s]} />
                  )
                })}
                {i % passoRotulo === 0 ? (
                  <text x={xGrupo(i) + grupo / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={T.mutedTexto} className="obra-num">
                    {rotulo(d)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
        {at ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-(--obra-border) bg-white px-3 py-2 text-[12px] leading-5 shadow-[0_4px_14px_rgba(0,52,94,0.12)]"
            // Sempre por `left` (+ translate): numa caixa com rolagem, `right` conta da borda visível e não de W.
            style={
              xGrupo(ativo!) > W / 2
                ? { left: xGrupo(ativo!) - 6, transform: 'translateX(-100%)' }
                : { left: xGrupo(ativo!) + grupo + 6 }
            }
          >
            <div className="obra-num font-semibold text-(--obra-ink)">
              {passo === 'semana' ? `Semana até ${rotulo(at)}` : rotulo(at)}
            </div>
            {series.map((s) => (
              <div key={s} className="flex justify-between gap-4 text-(--obra-text)">
                <span>{s === 'base' ? 'Base' : s === 'previsto' ? 'Previsto' : 'Realizado'}</span>
                <span className="obra-num">{fmtPP(at[s])}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p aria-live="polite" className="sr-only">
          {at
            ? `${rotulo(at)}: ${series.map((s) => `${s === 'base' ? 'Base' : s === 'previsto' ? 'Previsto' : 'Realizado'} ${fmtPP(at[s])}`).join(', ')}`
            : ''}
        </p>
      </div>

      {/* sr-only no wrapper: tabela ignora width:1px e vaza na largura da página. */}
      <div className="sr-only">
        <table>
          <caption>Avanço por período, em pontos percentuais</caption>
          <thead>
            <tr>
              <th scope="col">Período</th>
              {temBase ? <th scope="col">Base</th> : null}
              <th scope="col">Previsto</th>
              <th scope="col">Realizado</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.periodo}>
                <th scope="row">{rotulo(d)}</th>
                {temBase ? <td>{fmtPP(d.base)}</td> : null}
                <td>{fmtPP(d.previsto)}</td>
                <td>{fmtPP(d.realizado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
