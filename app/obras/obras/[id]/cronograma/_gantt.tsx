'use client'

/**
 * Gantt do cronograma (spec §5), SVG próprio. Uma linha por linha visível da
 * árvore, com a mesma altura. Por atividade: sombra da base (contorno cinza
 * tracejado, abaixo), barra do previsto (azul claro) com o % realizado em
 * laranja e, se a projeção passou do previsto, a extensão em vermelho hachurado.
 * Etapa = barra-resumo escura com colchetes (MS Project).
 *
 * Rolagem horizontal só aqui dentro; a vertical é sincronizada com a árvore.
 */
import { useMemo, type ReactNode, type Ref, type UIEvent } from 'react'
import PilulaSituacao from '../../_ui/pilula-situacao'
import { TEMA_OBRA as T } from '../../_ui/tema'
import { ALTURA_CABECALHO, ALTURA_LINHA, dataBR, type LinhaVisivel } from './_arvore'
import type { Escala } from './_barra-ferramentas'

const DIA_MS = 86_400_000
const PREVISTO = '#b6cadb'
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const iso = (m: number) => new Date(m).toISOString().slice(0, 10)

export type Dominio = { inicio: string; dias: number }

/** Do primeiro ao último dia relevante, começando numa segunda e com folga no fim. */
export function dominioDoGantt(linhas: LinhaVisivel[], hoje: string): Dominio {
  const datas = [hoje]
  for (const l of linhas) {
    if (l.tipo === 'etapa') {
      const e = l.etapa
      datas.push(e.inicio, e.fim, e.inicioProjetado, e.fimProjetado)
      if (e.inicioBase) datas.push(e.inicioBase)
      if (e.fimBase) datas.push(e.fimBase)
    } else {
      const a = l.atividade
      datas.push(a.inicioPrevisto, a.fimPrevisto, a.inicioProjetado, a.fimProjetado)
      if (a.inicioBase) datas.push(a.inicioBase)
      if (a.fimBase) datas.push(a.fimBase)
    }
  }
  const min = Math.min(...datas.map(ms))
  const max = Math.max(...datas.map(ms))
  const dow = new Date(min).getUTCDay() // 0 = domingo
  const inicio = min - ((dow + 6) % 7) * DIA_MS - 7 * DIA_MS
  return { inicio: iso(inicio), dias: Math.round((max - inicio) / DIA_MS) + 15 }
}

export const larguraDia = (e: Escala) => (e === 'dia' ? 28 : 12)

export default function Gantt({
  linhas,
  feriados,
  hoje,
  escala,
  mostrarBase,
  foco,
  onFoco,
  rolagemRef,
  onRolar,
}: {
  linhas: LinhaVisivel[]
  feriados: string[]
  hoje: string
  escala: Escala
  mostrarBase: boolean
  foco: string | null
  onFoco: (chave: string | null) => void
  rolagemRef?: Ref<HTMLDivElement>
  onRolar?: (e: UIEvent<HTMLDivElement>) => void
}) {
  const dom = useMemo(() => dominioDoGantt(linhas, hoje), [linhas, hoje])
  const dw = larguraDia(escala)
  const inicioMs = ms(dom.inicio)
  const largura = dom.dias * dw
  const altura = linhas.length * ALTURA_LINHA
  const xDe = (d: string) => Math.round((ms(d) - inicioMs) / DIA_MS) * dw
  /** x e largura de uma barra de `a` a `b` inclusive. */
  const faixa = (a: string, b: string) => ({ x: xDe(a), w: Math.max(xDe(b) - xDe(a) + dw, dw) })

  const fer = useMemo(() => new Set(feriados), [feriados])
  const dias = useMemo(
    () =>
      Array.from({ length: dom.dias }, (_, i) => {
        const m = inicioMs + i * DIA_MS
        const d = new Date(m)
        const data = iso(m)
        return { i, data, dia: d.getUTCDate(), mes: d.getUTCMonth(), ano: d.getUTCFullYear(), dow: d.getUTCDay(), folga: d.getUTCDay() === 0 || d.getUTCDay() === 6 || fer.has(data) }
      }),
    [dom.dias, inicioMs, fer],
  )
  const meses = useMemo(() => {
    const r: { x: number; w: number; rotulo: string }[] = []
    for (const d of dias) {
      if (d.i === 0 || d.dia === 1) r.push({ x: d.i * dw, w: 0, rotulo: `${MESES[d.mes]} ${d.ano}` })
      r[r.length - 1].w += dw
    }
    return r
  }, [dias, dw])
  const xHoje = xDe(hoje) + dw / 2

  const focoIdx = foco ? linhas.findIndex((l) => chaveDe(l) === foco) : -1

  return (
    <div
      ref={rolagemRef}
      onScroll={onRolar}
      onMouseLeave={() => onFoco(null)}
      className="relative h-full overflow-auto"
      data-x-hoje={xHoje}
    >
      <div style={{ width: largura }} className="relative">
        {/* Cabeçalho (fica no topo ao rolar) */}
        <div className="sticky top-0 z-10 bg-(--obra-surface)" style={{ height: ALTURA_CABECALHO }}>
          <svg width={largura} height={ALTURA_CABECALHO} aria-hidden="true" className="block">
            {meses.map((m) => (
              <g key={m.x}>
                <line x1={m.x} x2={m.x} y1={0} y2={ALTURA_CABECALHO} stroke={T.border} />
                <text x={m.x + 6} y={16} fontSize={11} fontWeight={600} fill={T.ink} className="uppercase">
                  {m.w > 40 ? m.rotulo : ''}
                </text>
              </g>
            ))}
            {dias.map((d) =>
              escala === 'dia' ? (
                <text
                  key={d.i}
                  x={d.i * dw + dw / 2}
                  y={38}
                  fontSize={11}
                  textAnchor="middle"
                  className="obra-num"
                  fill={d.folga ? T.mutedTexto : T.text}
                >
                  {d.dia}
                </text>
              ) : d.dow === 1 ? (
                <g key={d.i}>
                  <line x1={d.i * dw} x2={d.i * dw} y1={24} y2={ALTURA_CABECALHO} stroke={T.border} />
                  <text x={d.i * dw + 4} y={39} fontSize={11} className="obra-num" fill={T.text}>
                    {String(d.dia).padStart(2, '0')}/{String(d.mes + 1).padStart(2, '0')}
                  </text>
                </g>
              ) : null,
            )}
            <line x1={0} x2={largura} y1={24} y2={24} stroke={T.border} />
            <line x1={0} x2={largura} y1={ALTURA_CABECALHO - 0.5} y2={ALTURA_CABECALHO - 0.5} stroke={T.border} />
            <line x1={xHoje} x2={xHoje} y1={18} y2={ALTURA_CABECALHO} stroke={T.orange} strokeWidth={2} />
            <rect x={xHoje - 17} y={4} width={34} height={14} rx={7} fill={T.orange} />
            <text x={xHoje} y={14.5} fontSize={10} fontWeight={700} textAnchor="middle" fill="#1d1d1f">
              Hoje
            </text>
          </svg>
        </div>

        {/* Corpo */}
        <svg
          width={largura}
          height={altura}
          className="block"
          role="group"
          aria-label="Gantt do cronograma"
        >
          <defs>
            <pattern id="gantt-hachura-vermelha" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#fbecec" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={T.vermelho} strokeWidth="2.5" />
            </pattern>
            <pattern id="gantt-hachura-cinza" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#8a969c" strokeWidth="2" />
            </pattern>
          </defs>

          {/* Fins de semana e feriados */}
          {dias.map((d) =>
            d.folga ? <rect key={d.i} x={d.i * dw} y={0} width={dw} height={altura} fill="#efefed" /> : null,
          )}
          {escala === 'semana'
            ? dias.map((d) =>
                d.dow === 1 ? <line key={d.i} x1={d.i * dw} x2={d.i * dw} y1={0} y2={altura} stroke={T.border} strokeOpacity={0.6} /> : null,
              )
            : null}
          {linhas.map((_, i) => (
            <line key={i} x1={0} x2={largura} y1={(i + 1) * ALTURA_LINHA - 0.5} y2={(i + 1) * ALTURA_LINHA - 0.5} stroke={T.border} strokeOpacity={0.7} />
          ))}
          {focoIdx >= 0 ? (
            <rect x={0} y={focoIdx * ALTURA_LINHA} width={largura} height={ALTURA_LINHA} fill={T.ink} fillOpacity={0.05} />
          ) : null}

          {linhas.map((l, i) => {
            const y = i * ALTURA_LINHA
            const chave = chaveDe(l)
            const props = {
              tabIndex: 0,
              role: 'img' as const,
              'aria-label': rotuloDe(l),
              onMouseEnter: () => onFoco(chave),
              onFocus: () => onFoco(chave),
              className: 'outline-none',
            }
            if (l.tipo === 'etapa') {
              const e = l.etapa
              const p = faixa(e.inicio, e.fim)
              const b = mostrarBase && e.inicioBase && e.fimBase ? faixa(e.inicioBase, e.fimBase) : null
              return (
                <g key={chave} {...props}>
                  {b ? <rect x={b.x + 0.5} y={y + 30} width={b.w - 1} height={5} rx={1.5} fill="none" stroke={T.base} strokeDasharray="3 2" /> : null}
                  <rect x={p.x} y={y + 16} width={p.w} height={8} fill={T.ink} />
                  <rect x={p.x} y={y + 16} width={p.w * Math.min(1, e.percentual)} height={3} fill={T.orange} />
                  <polygon points={`${p.x},${y + 16} ${p.x + 7},${y + 16} ${p.x},${y + 28}`} fill={T.ink} />
                  <polygon points={`${p.x + p.w},${y + 16} ${p.x + p.w - 7},${y + 16} ${p.x + p.w},${y + 28}`} fill={T.ink} />
                </g>
              )
            }
            const a = l.atividade
            const p = faixa(a.inicioPrevisto, a.fimPrevisto)
            const b = mostrarBase && a.inicioBase && a.fimBase ? faixa(a.inicioBase, a.fimBase) : null
            const fimP = p.x + p.w
            const ext = a.fimProjetado > a.fimPrevisto ? { x: fimP, w: xDe(a.fimProjetado) + dw - fimP } : null
            const aguardando = a.situacao === 'aguardando_cliente'
            const concluida = a.situacao === 'concluida'
            return (
              <g key={chave} {...props}>
                {b ? <rect x={b.x + 0.5} y={y + 31} width={b.w - 1} height={6} rx={2} fill="none" stroke={T.base} strokeWidth={1.25} strokeDasharray="3 2" /> : null}
                <rect x={p.x} y={y + 10} width={p.w} height={18} rx={3} fill={a.travada ? '#d9dcde' : PREVISTO} />
                {a.percentual > 0 ? (
                  <rect x={p.x} y={y + 10} width={p.w * Math.min(1, a.percentual)} height={18} rx={3} fill={concluida ? T.verde : T.orange} />
                ) : null}
                {aguardando ? (
                  <rect x={p.x} y={y + 10} width={p.w} height={18} rx={3} fill="url(#gantt-hachura-vermelha)" fillOpacity={0.85} stroke={T.vermelho} />
                ) : null}
                {a.travada ? (
                  <rect x={p.x} y={y + 10} width={p.w} height={18} rx={3} fill="url(#gantt-hachura-cinza)" stroke="#8a969c" />
                ) : null}
                {ext && ext.w > 0 ? (
                  <rect x={ext.x} y={y + 12} width={ext.w} height={14} rx={2} fill="url(#gantt-hachura-vermelha)" stroke={T.vermelho} />
                ) : null}
                {a.travada ? <Cadeado x={fimP + (ext ? ext.w : 0) + 4} y={y + 12} /> : null}
              </g>
            )
          })}

          <line x1={xHoje} x2={xHoje} y1={0} y2={altura} stroke={T.orange} strokeWidth={2} />
        </svg>

        {focoIdx >= 0 ? (
          <Dica
            linha={linhas[focoIdx]}
            // Nas últimas linhas a dica abre para cima, para não sair do quadro.
            y={focoIdx * ALTURA_LINHA + ALTURA_CABECALHO - (focoIdx > linhas.length - 5 && focoIdx > 3 ? 150 : 0)} x={xDica(linhas[focoIdx], xDe, dw)} largura={largura} />
        ) : null}
      </div>
    </div>
  )
}

export const chaveDe = (l: LinhaVisivel) => (l.tipo === 'etapa' ? 'e:' + l.etapa.chave : 'a:' + l.atividade.numero)

function xDica(l: LinhaVisivel, xDe: (d: string) => number, dw: number) {
  const fim = l.tipo === 'etapa' ? l.etapa.fimProjetado : l.atividade.fimProjetado
  const fimP = l.tipo === 'etapa' ? l.etapa.fim : l.atividade.fimPrevisto
  return xDe(fim > fimP ? fim : fimP) + dw + 12
}

function rotuloDe(l: LinhaVisivel): string {
  if (l.tipo === 'etapa') {
    const e = l.etapa
    return `Etapa ${e.nome}: previsto ${dataBR(e.inicio)} a ${dataBR(e.fim)}, ${Math.round(e.percentual * 100)}%`
  }
  const a = l.atividade
  return `${a.numero} ${a.descricao}: previsto ${dataBR(a.inicioPrevisto)} a ${dataBR(a.fimPrevisto)}, projetado até ${dataBR(a.fimProjetado)}, ${Math.round(a.percentual * 100)}%`
}

function Cadeado({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <rect x={1} y={6} width={11} height={8} rx={1.5} fill="#4f5b62" />
      <path d="M3.5 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="#4f5b62" strokeWidth={1.6} />
    </g>
  )
}

function Dica({ linha, x, y, largura }: { linha: LinhaVisivel; x: number; y: number; largura: number }) {
  const esquerda = Math.min(x, Math.max(0, largura - 280))
  const item = (r: string, v: ReactNode) => (
    <div className="flex justify-between gap-4">
      <dt className="text-(--obra-muted-texto)">{r}</dt>
      <dd className="obra-num text-(--obra-text)">{v}</dd>
    </div>
  )
  const delta = (d: number | null) => (d === null ? '—' : d === 0 ? '0' : d > 0 ? `+${d}` : `−${-d}`)
  const conteudo =
    linha.tipo === 'etapa' ? (
      <>
        <p className="font-semibold text-(--obra-ink)">{linha.etapa.nome}</p>
        <dl className="mt-1.5 flex flex-col gap-0.5">
          {item('Previsto', `${dataBR(linha.etapa.inicio)} – ${dataBR(linha.etapa.fim)}`)}
          {item('Base', linha.etapa.inicioBase ? `${dataBR(linha.etapa.inicioBase)} – ${dataBR(linha.etapa.fimBase)}` : '—')}
          {item('Projetado', `${dataBR(linha.etapa.inicioProjetado)} – ${dataBR(linha.etapa.fimProjetado)}`)}
          {item('Realizado', `${Math.round(linha.etapa.percentual * 100)}%`)}
          {item('Δ vs base', delta(linha.etapa.delta))}
        </dl>
      </>
    ) : (
      <>
        <p className="font-semibold text-(--obra-ink)">
          {linha.atividade.numero} · {linha.atividade.descricao}
        </p>
        <div className="mt-1">
          <PilulaSituacao situacao={linha.atividade.situacao} status={linha.atividade.status} travada={linha.atividade.travada} />
        </div>
        <dl className="mt-1.5 flex flex-col gap-0.5">
          {item('Previsto', `${dataBR(linha.atividade.inicioPrevisto)} – ${dataBR(linha.atividade.fimPrevisto)}`)}
          {item('Base', linha.atividade.inicioBase ? `${dataBR(linha.atividade.inicioBase)} – ${dataBR(linha.atividade.fimBase)}` : '—')}
          {item('Projetado', `${dataBR(linha.atividade.inicioProjetado)} – ${dataBR(linha.atividade.fimProjetado)}`)}
          {item('Realizado', `${Math.round(linha.atividade.percentual * 100)}%`)}
          {item('Δ vs base', delta(linha.atividade.delta))}
        </dl>
      </>
    )
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-[268px] rounded-lg border border-(--obra-border) bg-white p-3 text-[12px] shadow-[0_6px_20px_rgba(0,52,94,0.14)]"
      style={{ left: esquerda, top: y + 4 }}
    >
      {conteudo}
    </div>
  )
}
