import type { ReactNode } from 'react'

/** Aviso / estado vazio das telas do mapa (tema claro). */
export default function AvisoMapa({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-6 py-10 text-center text-sm text-(--obra-text)">
      {children}
    </div>
  )
}
