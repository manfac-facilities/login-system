'use client'
import { useState } from 'react'

export interface ParFotos {
  posicao: string
  antes: string | null
  depois: string | null
}

function Foto({ url, legenda }: { url: string | null; legenda: string }) {
  return (
    <figure className="flex flex-col gap-1">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={legenda} className="rounded-lg w-full aspect-video object-cover bg-black" />
      ) : (
        <div className="rounded-lg w-full aspect-video bg-[#0d2050] border border-[#1e3a5f] flex items-center justify-center text-xs text-[#4a6080]">
          sem foto
        </div>
      )}
      <figcaption className="text-xs text-[#94a3b8]">{legenda}</figcaption>
    </figure>
  )
}

/**
 * Comparação das fotos obrigatórias de dois checklists: lado a lado, ou
 * sobrepostas com controle de opacidade. Não calcula diferença de imagem
 * (decisão 2 do histórico): quem compara é o olho de quem está vendo.
 */
export default function CompararFotos({
  pares,
  rotuloAntes,
  rotuloDepois,
  modoInicial,
}: {
  pares: ParFotos[]
  rotuloAntes: string
  rotuloDepois: string
  modoInicial: 'lado' | 'sobre'
}) {
  const [modo, setModo] = useState<'lado' | 'sobre'>(modoInicial)
  const [opacidade, setOpacidade] = useState(50)

  const botao = (m: 'lado' | 'sobre', rotulo: string) => (
    <button
      type="button"
      onClick={() => setModo(m)}
      className={`px-3 py-1.5 text-sm rounded-lg ${modo === m ? 'bg-[#f05a28] text-white' : 'text-[#94a3b8]'}`}
    >
      {rotulo}
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 p-1 rounded-lg border border-[#1e3a5f] w-fit">
        {botao('lado', 'Lado a lado')}
        {botao('sobre', 'Sobrepor')}
      </div>
      {modo === 'sobre' && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#94a3b8]">
            Arraste para ver a diferença entre {rotuloAntes} e {rotuloDepois}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={opacidade}
            onChange={(e) => setOpacidade(Number(e.target.value))}
            className="w-full accent-[#f05a28]"
          />
        </label>
      )}
      {pares.map((p) => (
        <div key={p.posicao} className="flex flex-col gap-1">
          <span className="text-sm text-white font-bold">{p.posicao}</span>
          {modo === 'lado' ? (
            <div className="grid grid-cols-2 gap-2">
              <Foto url={p.antes} legenda={`${p.posicao} · ${rotuloAntes}`} />
              <Foto url={p.depois} legenda={`${p.posicao} · ${rotuloDepois}`} />
            </div>
          ) : (
            <div className="relative">
              <Foto url={p.antes} legenda={`${p.posicao} · ${rotuloAntes} (embaixo) × ${rotuloDepois} (em cima)`} />
              {p.depois && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.depois}
                  alt={`${p.posicao} · ${rotuloDepois}`}
                  style={{ opacity: opacidade / 100 }}
                  className="absolute inset-x-0 top-0 rounded-lg w-full aspect-video object-cover"
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
