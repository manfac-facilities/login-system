'use client'
import { useState } from 'react'

export interface FotoItem {
  id: string
  url: string
  label?: string
}

/**
 * Grade de miniaturas com ampliação em tela cheia. Reutilizada no detalhe do
 * checklist e do sinistro (achado U-03 — fotos capturadas nunca eram
 * exibidas em lugar nenhum, write-only).
 */
export default function GaleriaFotos({ fotos }: { fotos: FotoItem[] }) {
  const [ampliada, setAmpliada] = useState<FotoItem | null>(null)

  if (fotos.length === 0) {
    return <p className="text-[#4a6080] text-sm">Nenhuma foto anexada.</p>
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {fotos.map((foto) => (
          <button
            key={foto.id}
            type="button"
            onClick={() => setAmpliada(foto)}
            className="relative rounded-lg overflow-hidden border border-[#1e3a5f] active:scale-95 transition-transform"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.url} alt={foto.label ?? 'Foto'} className="w-full h-28 object-cover" />
            {foto.label && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                {foto.label}
              </span>
            )}
          </button>
        ))}
      </div>

      {ampliada && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setAmpliada(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ampliada.url} alt={ampliada.label ?? 'Foto'} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}
