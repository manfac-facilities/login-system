import type { ReactNode } from 'react'
import TemaObras from '../obras/obras/layout'

/**
 * Prévia visual da Leva 1 (só desenvolvimento). Fica fora de /obras porque o
 * middleware exige sessão lá; reaproveita o layout do tema claro do módulo
 * (obras.css + IBM Plex Mono).
 */
export default function PreviaLayout({ children }: { children: ReactNode }) {
  return <TemaObras>{children}</TemaObras>
}
