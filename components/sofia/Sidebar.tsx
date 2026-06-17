'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface NavItem {
  label: string
  href: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    title: 'Operação',
    items: [
      { label: 'Visão Geral', href: '/sofia' },
      { label: 'Equipes', href: '/sofia/equipes' },
      { label: 'Veículos', href: '/sofia/veiculos' },
      { label: 'Motoristas', href: '/sofia/motoristas' },
      { label: 'KM Diário', href: '/sofia/km' },
      { label: 'Checklist', href: '/sofia/checklist' },
    ],
  },
  {
    title: 'Ocorrências',
    items: [
      { label: 'Multas', href: '/sofia/multas' },
      { label: 'Sinistros', href: '/sofia/sinistros' },
    ],
  },
  {
    title: 'Manutenção & Documentos',
    items: [
      { label: 'Revisões', href: '/sofia/revisoes' },
      { label: 'Documentos', href: '/sofia/documentos' },
      { label: 'Abastecimento', href: '/sofia/abastecimento' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Custos', href: '/sofia/custos' },
      { label: 'Disponibilidade', href: '/sofia/disponibilidade' },
      { label: 'Pendências', href: '/sofia/pendencias' },
    ],
  },
]

export const detailRoutes = [
  '/sofia/veiculos/[id]',
  '/sofia/motoristas/[id]',
  '/sofia/sinistros/[id]',
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 shrink-0 bg-[#0d2050] border-r border-[#1e3a5f] min-h-screen p-4">
      <div className="text-white font-bold text-lg mb-6 px-2">Sofia</div>
      {navSections.map((section) => (
        <div key={section.title} className="mb-6">
          <div className="text-[#4a6080] text-xs uppercase tracking-wide font-semibold px-2 mb-2">
            {section.title}
          </div>
          {section.items.map((item) => {
            const isActive =
              item.href === '/sofia'
                ? pathname === '/sofia'
                : pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-2 py-2 rounded text-sm mb-1 ${
                  isActive
                    ? 'bg-[#f05a28] text-white'
                    : 'text-[#94a3b8] hover:bg-[#1e3a5f] hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </aside>
  )
}

export default Sidebar
