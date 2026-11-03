'use client'

/**
 * Antes × depois do ponto (Leva 6, spec §2.7): comparação arrastável entre
 * duas fotos — padrões início × hoje (primeira × última) e ontem × hoje, ou
 * escolher datas — e a linha do tempo do ponto.
 */

import { useState } from 'react'
import { comparacaoPadrao, type FotoMapa } from '../../../../_lib/mapa'

export type FotoPonto = FotoMapa & { url: string | null }
type Modo = 'inicio' | 'ontem' | 'datas'

const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const rotuloFoto = (f: FotoPonto, i: number) => `${dataCurta(f.data)}/${f.data.slice(0, 4)} · foto ${i + 1}${f.legenda ? ` · ${f.legenda}` : ''}`

function Imagem({ f, alt }: { f: FotoPonto; alt: string }) {
  return f.url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={f.url} alt={alt} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center bg-(--obra-trilho) text-xs text-(--obra-muted-texto)">sem prévia</div>
  )
}

export default function CompararPonto({ fotos, hoje }: { fotos: FotoPonto[]; hoje: string }) {
  const [modo, setModo] = useState<Modo>('inicio')
  const [corte, setCorte] = useState(50)
  const [antesId, setAntesId] = useState(fotos[0]?.id ?? '')
  const [depoisId, setDepoisId] = useState(fotos[fotos.length - 1]?.id ?? '')

  const par =
    modo === 'datas'
      ? (() => {
          const antes = fotos.find((f) => f.id === antesId)
          const depois = fotos.find((f) => f.id === depoisId)
          return antes && depois ? { antes, depois } : null
        })()
      : (comparacaoPadrao(fotos, modo, hoje) as { antes: FotoPonto; depois: FotoPonto } | null)

  const vazio =
    modo === 'ontem'
      ? 'Para comparar ontem × hoje o ponto precisa de foto de hoje e de um dia anterior.'
      : 'O ponto precisa de pelo menos duas fotos para comparar.'

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Comparar" className="flex flex-wrap gap-1">
        {(
          [
            ['inicio', 'Início × hoje'],
            ['ontem', 'Ontem × hoje'],
            ['datas', 'Escolher datas'],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            type="button"
            aria-pressed={modo === v}
            onClick={() => setModo(v)}
            className={`min-h-11 rounded-lg border px-3 text-sm ${
              modo === v ? 'border-(--obra-ink) bg-(--obra-ink) text-white' : 'border-(--obra-border) bg-(--obra-card) text-(--obra-ink)'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {modo === 'datas' && fotos.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['Antes', antesId, setAntesId],
              ['Depois', depoisId, setDepoisId],
            ] as const
          ).map(([r, v, set]) => (
            <label key={r} className="flex flex-col gap-1 text-xs text-(--obra-muted-texto)">
              {r}
              <select value={v} onChange={(e) => set(e.target.value)} className="min-h-11 rounded-lg border border-(--obra-border) bg-(--obra-card) px-3 text-base text-(--obra-text)">
                {fotos.map((f, i) => (
                  <option key={f.id} value={f.id}>{rotuloFoto(f, i)}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {par ? (
        <div className="relative aspect-video w-full max-w-full overflow-hidden rounded-xl border border-(--obra-border) bg-(--obra-trilho)">
          <Imagem f={par.antes} alt={`Antes, ${dataCurta(par.antes.data)}`} />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${corte}%)` }}>
            <Imagem f={par.depois} alt={`Depois, ${dataCurta(par.depois.data)}`} />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${corte}%` }} />
          <span className="obra-num absolute top-2 left-2 rounded bg-[#00345ecc] px-2 text-xs text-white">{dataCurta(par.antes.data)} · antes</span>
          <span className="obra-num absolute top-2 right-2 rounded bg-[#00345ecc] px-2 text-xs text-white">{dataCurta(par.depois.data)} · depois</span>
          <input
            type="range"
            min={0}
            max={100}
            value={corte}
            onChange={(e) => setCorte(Number(e.target.value))}
            aria-label="Arraste para comparar antes e depois"
            className="absolute right-[5%] bottom-2 left-[5%] h-11 w-[90%] cursor-ew-resize"
          />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-4 py-8 text-center text-sm text-(--obra-muted-texto)">{vazio}</p>
      )}

      <section>
        <h3 className="mb-2 font-semibold text-(--obra-ink)">Linha do tempo</h3>
        {fotos.length ? (
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {fotos.map((f) => (
              <li key={f.id} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-(--obra-border)">
                <Imagem f={f} alt={`Foto de ${dataCurta(f.data)}`} />
                <span className="obra-num absolute bottom-1 left-1 rounded bg-[#00345ecc] px-1.5 text-[11px] text-white">
                  {dataCurta(f.data)}
                  {f.estado === 'rascunho' ? ' · rascunho' : ''}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-(--obra-muted-texto)">Nenhuma foto neste ponto ainda. As fotos entram pela ronda do diário.</p>
        )}
      </section>
    </div>
  )
}
