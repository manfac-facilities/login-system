'use client'
import { useEffect, type ReactNode } from 'react'

/**
 * Moldura de diálogo modal do Gestão de Frotas (mockup rodada 2, seções 3 e 4):
 * fundo escurecido, Esc e clique fora fecham.
 */
export default function Dialogo({
  titulo,
  subtitulo,
  onFechar,
  children,
}: {
  titulo: string
  subtitulo?: ReactNode
  onFechar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-6 text-left"
      >
        <h3 className="text-lg font-bold text-white">{titulo}</h3>
        {subtitulo && <p className="text-[#94a3b8] text-sm mt-1 mb-4">{subtitulo}</p>}
        {children}
      </div>
    </div>
  )
}

/** Bloco "O que acontece ao salvar" / "O que vai mudar". */
export function Consequencias({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-[#1e3a5f] bg-[#0d2050] p-4 text-sm text-[#94a3b8]">
      <b className="block text-white mb-2">{titulo}</b>
      {children}
    </div>
  )
}
