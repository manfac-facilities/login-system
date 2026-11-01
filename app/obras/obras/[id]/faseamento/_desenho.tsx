/**
 * Camadas da fase em SVG de navegador (mesmo desenho da prancha e do mockup
 * aprovado `obra-faseamento-6b.html`). Coordenadas relativas 0–1; o viewBox tem
 * largura 1000 e altura `V` (proporção da planta, ou 700 no quadro branco).
 */
import { useId } from 'react'
import { TIPOS, type Camada, type GrupoCamada, type Ponto, type TipoCamada } from './_lib/camadas'
import type { BaseDesenho } from './_tipos'
import { alturaDoQuadro } from './_regras'

export const U = 1000
const ORDEM: GrupoCamada[] = ['zona', 'linha', 'porta', 'fluxo', 'icone']
export const grupoDe = (t: TipoCamada) => TIPOS[t].grupo

/** Ordem de desenho do mockup: zonas por baixo, ícones por cima. */
export const emOrdem = (camadas: readonly Camada[]) =>
  [...camadas].sort((a, b) => ORDEM.indexOf(grupoDe(a.t)) - ORDEM.indexOf(grupoDe(b.t)))

export const caminho = (p: Ponto[], V: number) => 'M' + p.map(([x, y]) => `${(x * U).toFixed(1)} ${(y * V).toFixed(1)}`).join(' L')

/**
 * Pattern e setas com id próprio por desenho: a tela tem mais de um SVG (editor, celular, prévia) e um
 * `url(#id)` que apontasse para um SVG escondido (display:none) não desenharia a hachura nem a seta.
 */
export function Defs({ ns }: { ns: string }) {
  return (
    <defs>
      <pattern id={`${ns}-hx`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="12" height="12" fill="#fde9e1" />
        <path d="M0 0V12" stroke="#b42318" strokeOpacity={0.45} strokeWidth={3} />
      </pattern>
      {(['fluxo_cli', 'fluxo_obra'] as const).map((t) => (
        <marker key={t} id={`${ns}-seta-${t}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={TIPOS[t].cor} />
        </marker>
      ))}
    </defs>
  )
}

/** Uma camada. `alvo` acrescenta a área de toque invisível (editor). */
export function CamadaSvg({ c, V, ns, alvo = false }: { c: Camada; V: number; ns: string; alvo?: boolean }) {
  const d = TIPOS[c.t]
  if ('r' in c) {
    const [x, y, w, h] = [c.r[0] * U, c.r[1] * V, c.r[2] * U, c.r[3] * V]
    const obra = c.t === 'zona_obra'
    return (
      <g data-camada={c.id}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={c.t === 'restrita' ? `url(#${ns}-hx)` : d.cor}
          fillOpacity={c.t === 'restrita' ? 1 : 0.85}
          stroke={obra ? '#e0531f' : '#0d205055'}
          strokeWidth={obra ? 2 : 1}
          strokeDasharray={obra ? '8 5' : undefined}
        />
        {c.rot ? (
          <text
            x={x + w / 2}
            y={y + h / 2 + 5}
            textAnchor="middle"
            fontWeight={700}
            fontSize={w < 200 ? 13 : 17}
            letterSpacing={1.5}
            fill="#0d2050"
            fillOpacity={0.8}
            pointerEvents="none"
          >
            {c.rot}
          </text>
        ) : null}
      </g>
    )
  }
  if ('p' in c) {
    const dd = caminho(c.p, V)
    const fluxo = grupoDe(c.t) === 'fluxo'
    return (
      <g data-camada={c.id}>
        {alvo ? <path d={dd} fill="none" stroke="transparent" strokeWidth={26} /> : null}
        {fluxo ? (
          <path d={dd} fill="none" stroke={d.cor} strokeWidth={4} strokeDasharray="14 8" markerEnd={`url(#${ns}-seta-${c.t})`} pointerEvents="none" />
        ) : (
          <path
            d={dd}
            fill="none"
            stroke={d.cor}
            strokeWidth={c.t === 'drywall' ? 9 : 12}
            strokeLinecap="square"
            strokeDasharray={c.t === 'balcao' ? '26 4' : undefined}
            pointerEvents="none"
          />
        )}
      </g>
    )
  }
  const [x, y] = [c.at[0] * U, c.at[1] * V]
  return (
    <g data-camada={c.id}>
      {alvo ? <circle cx={x} cy={y} r={30} fill="transparent" /> : null}
      {grupoDe(c.t) === 'porta' ? (
        <g pointerEvents={alvo ? 'none' : undefined}>
          <rect x={x - 10} y={y - 36} width={20} height={72} fill="#fff" stroke={d.cor} strokeWidth={5} />
          <path d={`M${x - 8} ${y - 36} A72 72 0 0 0 ${x - 74} ${y + 30}`} fill="none" stroke={d.cor} strokeWidth={2} />
          <path d={`M${x - 8} ${y - 36} L${x - 74} ${y + 30}`} stroke={d.cor} strokeWidth={2} />
          <text x={x - 84} y={y + 56} textAnchor="end" fontWeight={700} fontSize={13} fill={d.cor}>
            {c.t === 'porta_obra' ? 'NOVA PORTA · SÓ OBRA' : 'ENTRADA EXISTENTE'}
          </text>
        </g>
      ) : c.t === 'extintor' ? (
        <g pointerEvents={alvo ? 'none' : undefined}>
          <circle cx={x} cy={y} r={15} fill={d.cor} />
          <path d={`M${x - 4} ${y - 8}h8v16h-8z`} fill="#fff" />
        </g>
      ) : (
        <g pointerEvents={alvo ? 'none' : undefined}>
          <rect x={x - 16} y={y - 11} width={32} height={22} rx={3} fill={d.cor} />
          <path d={`M${x - 9} ${y}h18M${x + 3} ${y - 6}l6 6-6 6`} stroke="#fff" strokeWidth={3} fill="none" />
        </g>
      )}
    </g>
  )
}

/** Fundo: a planta ou o quadro branco. */
export function Fundo({ base, V }: { base: BaseDesenho; V: number }) {
  return (
    <>
      <rect x={0} y={0} width={U} height={V} fill="#ffffff" />
      {base.url ? <image href={base.url} x={0} y={0} width={U} height={V} preserveAspectRatio="none" /> : null}
      <rect x={1} y={1} width={U - 2} height={V - 2} fill="none" stroke="#9aa3b2" strokeWidth={1.5} pointerEvents="none" />
    </>
  )
}

/** Desenho só de leitura (celular e revisão emitida fora do editor). */
export function DesenhoFase({ camadas, base }: { camadas: readonly Camada[]; base: BaseDesenho }) {
  const V = alturaDoQuadro(base.url ? base.largura : null, base.url ? base.altura : null)
  const ns = 'f' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <svg viewBox={`0 0 ${U} ${V}`} className="block h-auto w-full" role="img" aria-label="Planta de faseamento com as camadas da fase">
      <Defs ns={ns} />
      <Fundo base={base} V={V} />
      {emOrdem(camadas.filter((c) => !c.oculta)).map((c) => (
        <CamadaSvg key={c.id} c={c} V={V} ns={ns} />
      ))}
    </svg>
  )
}
