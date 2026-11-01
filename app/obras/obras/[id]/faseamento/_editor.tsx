'use client'

/**
 * Editor de camadas da fase (Leva 6b, mockup aprovado `obra-faseamento-6b.html`):
 * - zona: arrastar no desenho cria o retângulo;
 * - linha e fluxo: clique ponto a ponto; duplo clique ou Enter termina, Esc cancela;
 * - porta e ícone: um clique;
 * - "Selecionar e mover": clique escolhe, arrastar move (qualquer camada);
 * - lista de camadas: mostrar/ocultar, escolher; rótulo da zona escolhida; apagar.
 *
 * Coordenadas sempre relativas 0–1 à planta (ou ao quadro branco). Não grava:
 * entrega as camadas a quem chamou (`onChange`); "Salvar rascunho" é da tela.
 */

import { useEffect, useId, useRef, useState, type PointerEvent as PE } from 'react'
import { MAX_CAMADAS, MAX_PONTOS, MAX_ROTULO, TIPOS, type Camada, type CamadaZona, type Ponto, type TipoCamada } from './_lib/camadas'
import { CamadaSvg, Defs, Fundo, U, caminho, emOrdem, grupoDe } from './_desenho'
import { alturaDoQuadro, novoIdCamada } from './_regras'
import type { BaseDesenho } from './_tipos'

type Ferramenta = 'sel' | TipoCamada
type Rascunho = { t: TipoCamada; ini: Ponto; fim: Ponto } | { t: TipoCamada; p: Ponto[]; hover: Ponto | null }
type Arrasto = { id: string; ini: Ponto; orig: Camada; moveu: boolean }

const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b)
const r4 = (v: number) => Math.round(v * 1e4) / 1e4
const pt4 = ([x, y]: Ponto): Ponto => [r4(x), r4(y)]
const LADO_MINIMO = 0.01

const DICA: Record<string, string> = {
  sel: 'Clique numa camada para escolher; arraste para mover. Tudo fica em coordenadas relativas à planta, como no mapa.',
  zona: 'Arraste no desenho para criar o retângulo da zona.',
  linha: 'Clique ponto a ponto; duplo clique ou Enter termina, Esc cancela.',
  fluxo: 'Clique ponto a ponto; a seta aparece no fim. Duplo clique ou Enter termina, Esc cancela.',
  porta: 'Clique na parede onde fica a porta.',
  icone: 'Clique para posicionar.',
}

/** Retângulo normalizado e dentro do quadro (x+w ≤ 1, y+h ≤ 1), arredondado. */
function retangulo(a: Ponto, b: Ponto): [number, number, number, number] {
  const x = r4(Math.min(a[0], b[0]))
  const y = r4(Math.min(a[1], b[1]))
  return [x, y, Math.min(r4(Math.abs(b[0] - a[0])), r4(1 - x)), Math.min(r4(Math.abs(b[1] - a[1])), r4(1 - y))]
}

/** Camada deslocada de (dx, dy), sem sair do quadro. */
function deslocar(c: Camada, dx: number, dy: number): Camada {
  if ('r' in c) {
    const [x, y, w, h] = c.r
    const nx = r4(clamp(x + dx, 0, 1 - w))
    const ny = r4(clamp(y + dy, 0, 1 - h))
    return { ...c, r: [nx, ny, Math.min(w, r4(1 - nx)), Math.min(h, r4(1 - ny))] }
  }
  if ('p' in c) {
    const xs = c.p.map((q) => q[0])
    const ys = c.p.map((q) => q[1])
    const ddx = clamp(dx, -Math.min(...xs), 1 - Math.max(...xs))
    const ddy = clamp(dy, -Math.min(...ys), 1 - Math.max(...ys))
    return { ...c, p: c.p.map(([x, y]) => pt4([clamp(x + ddx), clamp(y + ddy)])) }
  }
  return { ...c, at: pt4([clamp(c.at[0] + dx), clamp(c.at[1] + dy)]) }
}

/** Tira pontos repetidos seguidos (o duplo clique dá dois cliques no mesmo lugar). */
const semRepetidos = (p: Ponto[]) => p.filter((q, i) => i === 0 || Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) > 0.002)

function Amostra({ t }: { t: TipoCamada }) {
  const d = TIPOS[t]
  const g = grupoDe(t)
  const cor = t === 'restrita' ? '#b42318' : d.cor
  return (
    <svg width={26} height={18} viewBox="0 0 28 20" aria-hidden="true" fill={cor} stroke={cor}>
      {g === 'zona' ? <rect x={3} y={3} width={22} height={14} rx={2} fill={t === 'restrita' ? '#fde9e1' : d.cor} stroke={t === 'zona_obra' ? '#e0531f' : cor} /> : null}
      {g === 'linha' ? <path d="M3 17L25 3" strokeWidth={4} /> : null}
      {g === 'porta' ? <path d="M5 18V2h4v16M9 2a14 14 0 0 1 12 14" strokeWidth={2.5} fill="none" /> : null}
      {g === 'fluxo' ? <path d="M3 15C10 2 18 18 25 5" fill="none" strokeWidth={3} strokeDasharray="5 3" /> : null}
      {g === 'icone' ? <circle cx={14} cy={10} r={7} /> : null}
    </svg>
  )
}

export default function EditorCamadas({
  camadas,
  onChange,
  base,
  somenteLeitura = false,
}: {
  camadas: Camada[]
  onChange: (c: Camada[]) => void
  base: BaseDesenho
  somenteLeitura?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const ns = 'f' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [ferramenta, setFerramenta] = useState<Ferramenta>('sel')
  const [selId, setSelId] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const V = alturaDoQuadro(base.url ? base.largura : null, base.url ? base.altura : null)
  const sel = camadas.find((c) => c.id === selId) ?? null
  const cheio = camadas.length >= MAX_CAMADAS

  function adicionar(c: Omit<Camada, 'id'>) {
    if (cheio) return setAviso(`No máximo ${MAX_CAMADAS} camadas por revisão.`)
    const nova = { ...c, id: novoIdCamada(camadas) } as Camada
    onChange([...camadas, nova])
    setSelId(nova.id)
    setAviso(`Adicionado: ${TIPOS[nova.t].nome}.`)
  }

  function terminarLinha(r: Rascunho | null) {
    if (!r || !('p' in r)) return
    const p = semRepetidos(r.p)
    if (p.length < 2) return setAviso('Clique pelo menos dois pontos para a linha.')
    setRascunho(null)
    adicionar({ t: r.t, p } as Omit<Camada, 'id'>)
  }

  // Enter termina a linha/fluxo em desenho; Esc cancela.
  useEffect(() => {
    if (!rascunho || !('p' in rascunho)) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRascunho(null)
        setAviso('Desenho cancelado.')
      } else if (e.key === 'Enter') {
        e.preventDefault()
        terminarLinha(rascunho)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  function rel(e: PE): Ponto {
    const r = svgRef.current!.getBoundingClientRect()
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)]
  }
  function capturar(e: PE) {
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* navegador sem captura: o arrasto segue enquanto o ponteiro estiver no desenho */
    }
  }

  function aoApertar(e: PE<SVGSVGElement>) {
    if (somenteLeitura) return
    const p = rel(e)
    if (ferramenta === 'sel') {
      const g = (e.target as Element).closest?.('[data-camada]')
      const id = g?.getAttribute('data-camada') ?? null
      const c = camadas.find((x) => x.id === id)
      setSelId(c?.id ?? null)
      if (c) {
        capturar(e)
        setArrasto({ id: c.id, ini: p, orig: c, moveu: false })
      }
      return
    }
    const g = grupoDe(ferramenta)
    if (g === 'zona') {
      capturar(e)
      setRascunho({ t: ferramenta, ini: p, fim: p })
    } else if (g === 'linha' || g === 'fluxo') {
      const atual = rascunho && 'p' in rascunho && rascunho.t === ferramenta ? rascunho.p : []
      if (atual.length >= MAX_PONTOS) return setAviso(`No máximo ${MAX_PONTOS} pontos por linha.`)
      setRascunho({ t: ferramenta, p: [...atual, pt4(p)], hover: null })
    } else {
      adicionar({ t: ferramenta, at: pt4(p) } as Omit<Camada, 'id'>)
    }
  }

  function aoMover(e: PE<SVGSVGElement>) {
    if (arrasto) {
      const p = rel(e)
      const movida = deslocar(arrasto.orig, p[0] - arrasto.ini[0], p[1] - arrasto.ini[1])
      if (!arrasto.moveu) setArrasto({ ...arrasto, moveu: true })
      return onChange(camadas.map((c) => (c.id === arrasto.id ? movida : c)))
    }
    if (!rascunho) return
    if ('ini' in rascunho) setRascunho({ ...rascunho, fim: rel(e) })
    else setRascunho({ ...rascunho, hover: rel(e) })
  }

  function aoSoltar() {
    if (arrasto) return setArrasto(null)
    if (rascunho && 'ini' in rascunho) {
      const r = retangulo(rascunho.ini, rascunho.fim)
      setRascunho(null)
      if (r[2] < LADO_MINIMO || r[3] < LADO_MINIMO) return setAviso('Arraste para desenhar o retângulo da zona.')
      adicionar({ t: rascunho.t, r } as Omit<CamadaZona, 'id'>)
    }
  }

  /** Gesto cancelado pelo sistema (tablet): volta ao original. */
  function aoCancelar() {
    if (arrasto) onChange(camadas.map((c) => (c.id === arrasto.id ? arrasto.orig : c)))
    setArrasto(null)
    if (rascunho && 'ini' in rascunho) setRascunho(null)
  }

  const escolher = (f: Ferramenta) => {
    setFerramenta(f)
    setRascunho(null)
    setAviso(null)
  }
  const alterar = (id: string, patch: Partial<Camada>) => onChange(camadas.map((c) => (c.id === id ? ({ ...c, ...patch } as Camada) : c)))
  const apagar = () => {
    if (!sel) return
    onChange(camadas.filter((c) => c.id !== sel.id))
    setSelId(null)
    setAviso(`Apagado: ${TIPOS[sel.t].nome}.`)
  }

  const visiveis = emOrdem(camadas.filter((c) => !c.oculta))
  const caixa = sel && !sel.oculta ? caixaDe(sel, V) : null
  const botaoBase = 'min-h-11 rounded-lg border px-3 text-left text-sm'

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,16rem)]">
      {!somenteLeitura ? (
        <section className="rounded-xl border border-(--obra-border) bg-(--obra-card) p-3">
          <h3 className="mb-2 text-sm font-semibold text-(--obra-ink)">Desenhar</h3>
          <div role="group" aria-label="Ferramenta" className="grid grid-cols-2 gap-1 lg:grid-cols-1">
            {(['sel', ...(Object.keys(TIPOS) as TipoCamada[])] as Ferramenta[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={ferramenta === f}
                onClick={() => escolher(f)}
                className={`${botaoBase} flex items-center gap-2 ${ferramenta === f ? 'border-(--obra-ink) bg-(--obra-ink) text-white' : 'border-(--obra-border) bg-(--obra-card) text-(--obra-ink)'}`}
              >
                {f === 'sel' ? (
                  <svg width={26} height={18} viewBox="0 0 28 28" aria-hidden="true">
                    <path d="M7 4l14 10-6 1 4 8-3 1-4-8-5 4z" fill="currentColor" />
                  </svg>
                ) : (
                  <Amostra t={f} />
                )}
                <span>{f === 'sel' ? 'Selecionar e mover' : TIPOS[f].nome}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-(--obra-muted-texto)">{DICA[ferramenta === 'sel' ? 'sel' : grupoDe(ferramenta)]}</p>
        </section>
      ) : null}

      <section className={`min-w-0 rounded-xl border border-(--obra-border) bg-(--obra-card) p-3 ${somenteLeitura ? 'lg:col-span-2' : ''}`}>
        <div className="overflow-hidden rounded-lg border border-(--obra-border)">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${U} ${V}`}
            className="block h-auto w-full select-none"
            style={{ touchAction: 'none' }}
            role="application"
            aria-label="Editor de camadas da fase"
            onPointerDown={aoApertar}
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerCancel={aoCancelar}
            onDoubleClick={() => terminarLinha(rascunho)}
          >
            <Defs ns={ns} />
            <Fundo base={base} V={V} />
            {visiveis.map((c) => (
              <CamadaSvg key={c.id} c={c} V={V} ns={ns} alvo={!somenteLeitura} />
            ))}
            {caixa ? (
              <rect
                data-selecao={sel!.id}
                x={caixa.x - 6}
                y={caixa.y - 6}
                width={caixa.w + 12}
                height={caixa.h + 12}
                fill="none"
                stroke="#f05a28"
                strokeWidth={2}
                strokeDasharray="6 4"
                pointerEvents="none"
              />
            ) : null}
            {rascunho && 'ini' in rascunho ? (
              (() => {
                const [x, y, w, h] = retangulo(rascunho.ini, rascunho.fim)
                return <rect x={x * U} y={y * V} width={w * U} height={h * V} fill={TIPOS[rascunho.t].cor} fillOpacity={0.6} stroke="#f05a28" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />
              })()
            ) : null}
            {rascunho && 'p' in rascunho && rascunho.p.length ? (
              <g pointerEvents="none">
                <path d={caminho(rascunho.hover ? [...rascunho.p, rascunho.hover] : rascunho.p, V)} fill="none" stroke={TIPOS[rascunho.t].cor} strokeWidth={5} strokeDasharray="6 5" opacity={0.8} />
                {rascunho.p.map((q, i) => (
                  <circle key={i} cx={q[0] * U} cy={q[1] * V} r={5} fill="#f05a28" />
                ))}
              </g>
            ) : null}
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p role="status" aria-live="polite" className="text-xs text-(--obra-muted-texto)">
            {aviso ?? (somenteLeitura ? 'Revisão em leitura.' : `${camadas.length} camada(s).`)}
          </p>
          {!somenteLeitura ? (
            <button type="button" disabled={!sel} onClick={apagar} className="min-h-11 rounded-lg border border-(--obra-border) bg-(--obra-card) px-3 text-sm text-(--obra-ink) disabled:opacity-45">
              Apagar selecionada
            </button>
          ) : null}
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-(--obra-border) bg-(--obra-card) p-3">
        {sel && 'r' in sel && !somenteLeitura ? (
          <label className="flex flex-col gap-1 text-xs text-(--obra-muted-texto)">
            Rótulo da zona
            <input
              value={sel.rot ?? ''}
              maxLength={MAX_ROTULO}
              onChange={(e) => alterar(sel.id, { rot: e.target.value || undefined })}
              className="min-h-11 rounded-lg border border-(--obra-border) bg-white px-3 text-base text-(--obra-text)"
            />
          </label>
        ) : null}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-(--obra-ink)">Camadas</h3>
          {camadas.length ? (
            <ul aria-label="Camadas" className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
              {camadas.map((c) => (
                <li key={c.id} className={`flex items-center gap-2 rounded-lg border px-2 ${c.id === selId ? 'border-(--obra-orange-texto)' : 'border-transparent'}`}>
                  <input
                    type="checkbox"
                    className="size-5 shrink-0"
                    aria-label={`Mostrar ${TIPOS[c.t].nome}${'rot' in c && c.rot ? ` ${c.rot}` : ''}`}
                    checked={!c.oculta}
                    disabled={somenteLeitura}
                    onChange={(e) => alterar(c.id, { oculta: e.target.checked ? undefined : true })}
                  />
                  <button type="button" onClick={() => setSelId(c.id)} className="flex min-h-11 flex-1 items-center gap-2 text-left text-sm text-(--obra-text)">
                    <Amostra t={c.t} />
                    <span className="min-w-0 break-words">
                      {TIPOS[c.t].nome}
                      {'rot' in c && c.rot ? ` · ${c.rot.toLowerCase()}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-(--obra-muted-texto)">Nenhuma camada ainda.</p>
          )}
        </div>
      </section>
    </div>
  )
}

/** Caixa (em unidades do viewBox) que envolve a camada, para o contorno de seleção. */
function caixaDe(c: Camada, V: number): { x: number; y: number; w: number; h: number } {
  if ('r' in c) return { x: c.r[0] * U, y: c.r[1] * V, w: c.r[2] * U, h: c.r[3] * V }
  const pts = 'p' in c ? c.p : [c.at]
  const xs = pts.map((q) => q[0] * U)
  const ys = pts.map((q) => q[1] * V)
  const folga = 'at' in c ? 30 : 0
  return { x: Math.min(...xs) - folga, y: Math.min(...ys) - folga, w: Math.max(...xs) - Math.min(...xs) + 2 * folga, h: Math.max(...ys) - Math.min(...ys) + 2 * folga }
}
