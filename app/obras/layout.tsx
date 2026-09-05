'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Esqueleto do módulo Controle de Obras.
 *
 * As três abas são as do mockup aprovado (`shellHTML`, mockup-obras.html:2415),
 * na mesma ordem: Diário do dia, Tarefas, Base de obras. A Ficha da obra NÃO é
 * aba — abre a partir de qualquer uma das três e volta para a origem. A Triagem
 * também não: é o modo da Ficha quando a etapa é "definir".
 *
 * O layout é client component só por causa do `usePathname`, que marca a aba
 * atual. As páginas continuam sendo server components — elas chegam por
 * `children`.
 *
 * Tema: hex literal em classe Tailwind arbitrária, como no resto do hub. Não
 * existe tailwind.config neste projeto (Tailwind v4 por @import em globals.css).
 */

const ABAS = [
  { href: '/obras/diario', label: 'Diário do dia' },
  { href: '/obras/tarefas', label: 'Tarefas' },
  { href: '/obras/base', label: 'Base de obras' },
]

export default function ObrasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <header className="border-b border-[#1e3a5f] bg-[#0d2050]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-[#94a3b8] text-sm hover:text-white transition-colors whitespace-nowrap"
          >
            ← Voltar ao Hub
          </Link>
          <span className="text-white text-sm font-semibold">Controle de Obras</span>
        </div>
        <nav
          aria-label="Seções do Controle de Obras"
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
      </header>
      <main>{children}</main>
    </div>
  )
}
