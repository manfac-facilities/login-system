'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/ui/Logo'

const navItems = [
  { href: '/sofia', label: 'Visão Geral', icon: '◈' },
  { href: '/sofia/equipes', label: 'Equipes', icon: '🚐' },
  { href: '/sofia/veiculos', label: 'Veículos', icon: '🚗' },
  { href: '/sofia/motoristas', label: 'Motoristas', icon: '👤' },
  { href: '/sofia/km', label: 'KM Diário', icon: '📍' },
  { href: '/sofia/checklist', label: 'Checklist', icon: '✓' },
  { href: '/sofia/multas', label: 'Multas', icon: '⚠' },
  { href: '/sofia/revisoes', label: 'Revisões', icon: '🔧' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-[#0d2050] border-r border-[#1e3a5f] min-h-screen">
      <div className="px-4 py-5 border-b border-[#1e3a5f]">
        <Logo size="sm" />
        <p className="text-xs text-[#4a6080] mt-1 font-medium tracking-wide uppercase">Sofia</p>
      </div>
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === '/sofia'
              ? pathname === '/sofia'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-[#f05a28] text-white font-medium'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#1e3a5f]'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-[#1e3a5f]">
        <Link
          href="/dashboard"
          className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors"
        >
          ← Hub Manfac
        </Link>
      </div>
    </aside>
  )
}
