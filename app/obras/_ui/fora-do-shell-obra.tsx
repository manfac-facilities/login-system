'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/** Páginas de uma obra (`/obras/obras/<id>` e abaixo) usam o ShellObra. */
export const dentroDoShellObra = (pathname: string) => /^\/obras\/obras\/[^/]+(\/|$)/.test(pathname)

/**
 * Esconde o cabeçalho escuro do Gestão de Obras (voltar ao hub + abas) dentro
 * do shell da obra, que tem a própria navegação e o "← Gestão de Obras"
 * (spec Leva 1 §8.1-6). Fora dele, renderiza normalmente.
 */
export default function ForaDoShellObra({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  return dentroDoShellObra(pathname) ? null : <>{children}</>
}
