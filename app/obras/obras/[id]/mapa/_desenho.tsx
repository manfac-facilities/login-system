/**
 * Desenho do mapa da obra (Leva 6): planta (imagem com os ambientes por cima)
 * ou croqui (só os retângulos), em SVG com coordenadas relativas 0–1 escaladas
 * para o quadro. Sem biblioteca. Usado pela tela interna (e pode ser usado pelo
 * portal: recebe só o que desenha, nada interno).
 */

import type { ModoMapa } from '../../_lib/mapa-leitura'

/** Faixas de avanço (spec §2.4): 0, 1–25, 26–50, 51–75, 76–100%. Mesmas cores do mockup aprovado. */
export const CORES_FAIXA = ['#e9edf5', '#cfe3f7', '#9cc6ee', '#5d9fdc', '#2c6db4'] as const
export const ROTULOS_FAIXA = ['0%', '1–25%', '26–50%', '51–75%', '76–100%'] as const
const TINTA = '#00345e'
const LARANJA = '#f85e0b'
const VERMELHO = '#b23232'

/** Tamanho do quadro: a imagem da planta (px) ou 1000 × 625 no croqui. */
export function quadroDe(modo: ModoMapa, largura: number | null, altura: number | null): { W: number; H: number } {
  if (modo === 'planta' && largura && altura) return { W: largura, H: altura }
  return { W: 1000, H: 625 }
}

export const pctTexto = (p: number | null) => (p === null ? '—' : `${Math.round(p * 100)}%`)

export type AmbienteDesenho = {
  id: string
  nome: string
  x: number | null
  y: number | null
  w: number | null
  h: number | null
  faixa: 0 | 1 | 2 | 3 | 4 | null
  /** Segunda linha do rótulo (ex.: "64% · 412 m²"). */
  detalhe?: string
  impedimento?: boolean
}
export type PontoDesenho = { id: string; numero: number; nome: string; x: number | null; y: number | null }

export default function DesenhoMapa({
  modo,
  plantaUrl,
  plantaLargura,
  plantaAltura,
  ambientes,
  pontos,
  selecionado,
  onSelecionar,
}: {
  modo: 'planta' | 'croqui'
  plantaUrl: string | null
  plantaLargura: number | null
  plantaAltura: number | null
  ambientes: AmbienteDesenho[]
  pontos: PontoDesenho[]
  selecionado?: string | null
  onSelecionar?: (id: string) => void
}) {
  const comImagem = modo === 'planta' && !!plantaUrl
  const { W, H } = quadroDe(comImagem ? 'planta' : 'croqui', plantaLargura, plantaAltura)
  const u = W / 1000 // unidade: 1/1000 da largura, para texto e traço não mudarem com o tamanho da imagem
  const desenhados = ambientes.filter((a) => a.x !== null && a.y !== null && a.w !== null && a.h !== null)
  const comPosicao = pontos.filter((p) => p.x !== null && p.y !== null)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={comImagem ? 'Planta da obra com os ambientes' : 'Croqui da obra com os ambientes'}
    >
      <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
      {comImagem ? <image href={plantaUrl!} x={0} y={0} width={W} height={H} preserveAspectRatio="none" /> : null}
      {desenhados.map((a) => {
        const x = a.x! * W
        const y = a.y! * H
        const w = a.w! * W
        const h = a.h! * H
        const sel = a.id === selecionado
        const fill = a.faixa === null ? 'transparent' : CORES_FAIXA[a.faixa]
        const escuro = a.faixa !== null && a.faixa >= 3 && !comImagem
        return (
          <g
            key={a.id}
            data-ambiente={a.id}
            role={onSelecionar ? 'button' : undefined}
            tabIndex={onSelecionar ? 0 : undefined}
            aria-label={onSelecionar ? `${a.nome}${a.detalhe ? ` · ${a.detalhe}` : ''}` : undefined}
            aria-pressed={onSelecionar ? sel : undefined}
            onClick={onSelecionar ? () => onSelecionar(a.id) : undefined}
            onKeyDown={
              onSelecionar
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelecionar(a.id)
                    }
                  }
                : undefined
            }
            className={onSelecionar ? 'cursor-pointer' : undefined}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={fill}
              fillOpacity={comImagem ? 0.55 : 1}
              stroke={sel ? LARANJA : TINTA}
              strokeWidth={(sel ? 3 : 1.5) * u}
              strokeDasharray={a.faixa === null ? `${6 * u} ${4 * u}` : undefined}
            />
            <text x={x + 12 * u} y={y + 24 * u} fontSize={15 * u} fontWeight={600} fill={escuro ? '#ffffff' : TINTA} pointerEvents="none">
              {a.nome}
            </text>
            {a.detalhe ? (
              <text x={x + 12 * u} y={y + 44 * u} fontSize={13 * u} fill={escuro ? '#ffffff' : TINTA} pointerEvents="none" className="obra-num">
                {a.detalhe}
              </text>
            ) : null}
            {a.impedimento ? (
              <g aria-label="impedimento aberto" pointerEvents="none">
                <path
                  d={`M${x + w - 30 * u} ${y + 10 * u} l${12 * u} ${22 * u} h${-24 * u}z`}
                  fill={VERMELHO}
                  stroke="#ffffff"
                  strokeWidth={1.5 * u}
                />
                <text x={x + w - 33 * u} y={y + 29 * u} fontSize={13 * u} fontWeight={700} fill="#ffffff">!</text>
              </g>
            ) : null}
          </g>
        )
      })}
      {comPosicao.map((p) => (
        <g key={p.id} pointerEvents="none" aria-label={`Ponto ${p.numero} · ${p.nome}`}>
          <circle cx={p.x! * W} cy={p.y! * H} r={13 * u} fill="#ffffff" stroke={TINTA} strokeWidth={2 * u} />
          <text
            x={p.x! * W}
            y={p.y! * H + 4.5 * u}
            textAnchor="middle"
            fontSize={12 * u}
            fontWeight={600}
            fill={TINTA}
            className="obra-num"
          >
            {p.numero}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** Legenda das faixas, do ponto e do ▲. */
export function LegendaMapa() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--obra-muted-texto)">
      {CORES_FAIXA.map((c, i) => (
        <span key={c} className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm border border-[#00345e33]" style={{ background: c }} />
          {ROTULOS_FAIXA[i]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <i className="inline-block h-3 w-3 rounded-sm border border-dashed border-[#00345e]" />
        sem atividade ligada
      </span>
      <span>número = ponto de foto</span>
      <span className="text-(--obra-vermelho-texto)">▲ impedimento aberto</span>
    </div>
  )
}
