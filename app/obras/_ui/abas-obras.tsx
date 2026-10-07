'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Abas do módulo. É o único pedaço cliente do layout: `usePathname` marca a
 * aba atual. Tudo o mais no layout é Server Component.
 */

const ABAS = [
  { href: '/obras/diario', label: 'Diário do dia' },
  { href: '/obras/tarefas', label: 'Tarefas' },
  { href: '/obras/base', label: 'Base de obras' },
  // Painel gerencial (spec-painel-gerencial-2026-09-29): aba nova, depois da Base.
  { href: '/obras/painel', label: 'Painel gerencial' },
]

export default function AbasObras() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Seções da Gestão de Obras"
      className="max-w-7xl mx-auto px-6 pb-3 flex gap-2 overflow-x-auto"
    >
      {ABAS.map((aba) => {
        const atual = pathname === aba.href || pathname.startsWith(aba.href + '/')
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={atual ? 'page' : undefined}
            className={
              'text-sm px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ' +
              (atual
                ? 'bg-[#f05a28] border-[#f05a28] text-white font-semibold'
                : 'border-[#1e3a5f] text-[#94a3b8] hover:text-white hover:border-[#f05a28]')
            }
          >
            {aba.label}
          </Link>
        )
      })}
    </nav>
  )
}
