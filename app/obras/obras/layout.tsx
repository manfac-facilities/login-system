import type { ReactNode } from 'react'
import { IBM_Plex_Mono } from 'next/font/google'
import './obras.css'

/**
 * Tema claro Manfac em toda a árvore /obras/obras/** (spec Leva 1 §4, §8.1-6).
 * Inter já vem do layout raiz; aqui entra o IBM Plex Mono (números, datas, %)
 * como variável `--font-plex-mono`, usada pela classe `.obra-num`.
 */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export default function ObrasGrandesLayout({ children }: { children: ReactNode }) {
  return <div className={`obra-tema ${plexMono.variable}`}>{children}</div>
}
