'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import type { Serie } from '../_lib/curvas'
import { ddmm, LegendaSeries, mesAno, pct } from './cartao-painel'
import { TEMA_OBRA as T } from './tema'

/**
 * Curva S do painel (spec Leva 1 §6.3, §8.1-2): avanço físico acumulado no tempo.
 * Base = cinza tracejada (a "foto" da v1), Previsto = azul (versão vigente),
 * Realizado = laranja até a data de status, linha "Hoje". Legenda em texto acima
 * e rótulo direto na ponta de cada série; passar o mouse ou focar e usar as setas
 * mostra os valores da data; a tabela escondida repete tudo para leitor de tela.
 * Sem animação (nada a desligar no `prefers-reduced-motion`).
 */

/** Largura do contêiner (o SVG é desenhado em pixels reais, para o texto não encolher no celular). */
export function useLargura(ref: RefObject<HTMLElement | null>, padrao: number) {
  const [largura, setLargura] = useState(padrao)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return largura
}

const DIA = 86_400_000
const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
const valorEm = (s: Serie | null, d: string) => s?.find((p) => p.data === d)?.valor ?? null

export default function CurvaS({
  base,
  previsto,
  realizado,
  hoje,
  dadosAte,
}: {
  base: Serie | null
  previsto: Serie
  realizado: Serie
  hoje: string
  dadosAte: string | null
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const W = useLargura(caixa, 720)
  const [ativo, setAtivo] = useState<number | null>(null)

  const largo = W >= 520
  const H = largo ? 280 : 240
  const M = { t: 16, r: largo ? 104 : 14, b: 28, l: 38 }
  const iw = W - M.l - M.r
  const ih = H - M.t - M.b

  const datas = previsto.map((p) => p.data)
  const t0 = ms(datas[0])
  const t1 = Math.max(ms(datas[datas.length - 1]), t0 + DIA)
  const x = (d: string) => M.l + ((ms(d) - t0) / (t1 - t0)) * iw
  const y = (v: number) => M.t + (1 - Math.min(1, Math.max(0, v))) * ih
  const caminho = (s: Serie) => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.data).toFixed(1)},${y(p.valor).toFixed(1)}`).join('')

  // Eixo X: ~1 rótulo a cada 90px; obra longa (> 6 meses) rotula por mês.
  const longa = t1 - t0 > 183 * DIA
  const passo = Math.max(1, Math.ceil(datas.length / Math.max(2, Math.floor(iw / 90))))
  const ticksX = datas.filter((_, i) => i % passo === 0)
  const ultimoR = realizado[realizado.length - 1]
  const hojeDentro = ms(hoje) >= t0 && ms(hoje) <= t1

  // Rótulos diretos na margem direita (Base/Previsto) e na ponta do Realizado.
  const rotulos: { id: string; texto: string; y: number }[] = []
  if (largo) {
    if (base?.length) rotulos.push({ id: 'base', texto: `Base ${pct(base[base.length - 1].valor)}`, y: y(base[base.length - 1].valor) })
    rotulos.push({ id: 'previsto', texto: `Previsto ${pct(previsto[previsto.length - 1].valor)}`, y: y(previsto[previsto.length - 1].valor) })
    rotulos.sort((a, b) => a.y - b.y)
    for (let i = 1; i < rotulos.length; i++) rotulos[i].y = Math.max(rotulos[i].y, rotulos[i - 1].y + 14)
  }

  const linhaDe = (i: number) => {
    const d = datas[i]
    const r = valorEm(realizado, d)
    const b = valorEm(base, d)
    return {
      d,
      texto: `${ddmm(d)}: ${b === null ? '' : `Base ${pct(b)}, `}Previsto ${pct(previsto[i].valor)}${r === null ? '' : `, Realizado ${pct(r)}`}`,
      b,
      p: previsto[i].valor,
      r,
    }
  }
  const at = ativo === null ? null : linhaDe(ativo)

  const mover = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    let melhor = 0
    for (let i = 1; i < datas.length; i++) if (Math.abs(x(datas[i]) - px) < Math.abs(x(datas[melhor]) - px)) melhor = i
    setAtivo(melhor)
  }
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const ult = datas.length - 1
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

  return (
    <div className="flex flex-col gap-3">
      <LegendaSeries
        itens={[
          { serie: 'base', detalhe: base ? 'v1 salva' : 'ainda não salva' },
          { serie: 'previsto', detalhe: 'versão vigente' },
          { serie: 'realizado', detalhe: dadosAte ? `até ${ddmm(dadosAte)}` : 'sem medição' },
        ]}
      />
      <div
        ref={caixa}
        tabIndex={0}
        role="group"
        aria-label="Gráfico da curva S. Use as setas para percorrer as datas."
        onKeyDown={teclas}
        onBlur={() => setAtivo(null)}
        className="relative w-full rounded-lg"
      >
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          aria-hidden="true"
          focusable="false"
          className="block max-w-full touch-pan-y"
          onPointerMove={mover}
          onPointerLeave={() => setAtivo(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={M.l} x2={M.l + iw} y1={y(v)} y2={y(v)} stroke={v === 0 ? T.border : T.trilho} strokeWidth="1" />
              <text x={M.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill={T.mutedTexto} className="obra-num">
                {v * 100}%
              </text>
            </g>
          ))}
          {ticksX.map((d) => (
            <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="11" fill={T.mutedTexto} className="obra-num">
              {longa ? mesAno(d) : ddmm(d)}
            </text>
          ))}

          {hojeDentro ? (
            <g>
              <line x1={x(hoje)} x2={x(hoje)} y1={M.t} y2={M.t + ih} stroke={T.mutedTexto} strokeWidth="1" strokeDasharray="2 3" />
              <text x={x(hoje)} y={M.t - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={T.mutedTexto}>
                Hoje
              </text>
            </g>
          ) : null}

          {realizado.length > 1 ? (
            <path
              d={`${caminho(realizado)}L${x(ultimoR.data).toFixed(1)},${y(0)}L${x(realizado[0].data).toFixed(1)},${y(0)}Z`}
              fill={T.orange}
              fillOpacity="0.1"
            />
          ) : null}
          {base?.length ? (
            <path d={caminho(base)} fill="none" stroke={T.base} strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
          ) : null}
          <path d={caminho(previsto)} fill="none" stroke={T.ink} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {realizado.length > 1 ? (
            <path d={caminho(realizado)} fill="none" stroke={T.orange} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {ultimoR ? (
            <g>
              <circle cx={x(ultimoR.data)} cy={y(ultimoR.valor)} r="4.5" fill={T.orange} stroke="#fff" strokeWidth="2" />
              <text
                x={x(ultimoR.data) + 8} y={y(ultimoR.valor) - 8} fontSize="12" fontWeight="600" fill={T.orangeTexto}
                stroke="#fff" strokeWidth="3" paintOrder="stroke" className="obra-num"
              >
                {largo ? `Realizado ${pct(ultimoR.valor)}` : pct(ultimoR.valor)}
              </text>
            </g>
          ) : null}
          {rotulos.map((r) => (
            <text key={r.id} x={M.l + iw + 8} y={r.y} dy="0.32em" fontSize="12" fill={r.id === 'base' ? T.mutedTexto : T.ink} className="obra-num">
              {r.texto}
            </text>
          ))}

          {at ? (
            <g>
              <line x1={x(at.d)} x2={x(at.d)} y1={M.t} y2={M.t + ih} stroke={T.ink} strokeOpacity="0.25" strokeWidth="1" />
              {at.b !== null ? <circle cx={x(at.d)} cy={y(at.b)} r="4" fill="#fff" stroke={T.base} strokeWidth="2" /> : null}
              <circle cx={x(at.d)} cy={y(at.p)} r="4" fill={T.ink} stroke="#fff" strokeWidth="2" />
              {at.r !== null ? <circle cx={x(at.d)} cy={y(at.r)} r="4" fill={T.orange} stroke="#fff" strokeWidth="2" /> : null}
            </g>
          ) : null}
        </svg>

        {at ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-(--obra-border) bg-white px-3 py-2 text-[12px] leading-5 shadow-[0_4px_14px_rgba(0,52,94,0.12)]"
            style={x(at.d) > W / 2 ? { right: W - x(at.d) + 10 } : { left: x(at.d) + 10 }}
          >
            <div className="obra-num font-semibold text-(--obra-ink)">{ddmm(at.d)}</div>
            {at.b !== null ? <Linha nome="Base" valor={pct(at.b)} /> : null}
            <Linha nome="Previsto" valor={pct(at.p)} />
            <Linha nome="Realizado" valor={at.r === null ? '—' : pct(at.r)} />
          </div>
        ) : null}
        <p aria-live="polite" className="sr-only">
          {at?.texto ?? ''}
        </p>
      </div>

      <table className="sr-only">
        <caption>Curva S: avanço acumulado por data</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Base</th>
            <th scope="col">Previsto</th>
            <th scope="col">Realizado</th>
          </tr>
        </thead>
        <tbody>
          {datas.map((d, i) => {
            const l = linhaDe(i)
            return (
              <tr key={d}>
                <th scope="row">{ddmm(d)}</th>
                <td>{l.b === null ? '—' : pct(l.b)}</td>
                <td>{pct(l.p)}</td>
                <td>{l.r === null ? '—' : pct(l.r)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Linha({ nome, valor }: { nome: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 text-(--obra-text)">
      <span>{nome}</span>
      <span className="obra-num">{valor}</span>
    </div>
  )
}
